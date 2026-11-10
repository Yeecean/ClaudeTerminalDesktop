param(
  [Parameter(Mandatory = $true)]
  [int]$ParentPid,
  [Parameter(Mandatory = $true)]
  [string]$ControlDir,
  [Parameter(Mandatory = $true)]
  [string]$StatusFile,
  [string]$LogPath
)

$ErrorActionPreference = 'Stop'

function Write-GuardLog([string]$Message) {
  if (-not $LogPath) { return }
  try {
    Add-Content -LiteralPath $LogPath -Value "$(Get-Date -Format o) $Message"
  } catch {}
}

function Write-GuardStatus([string]$Value) {
  try {
    Set-Content -LiteralPath $StatusFile -Value $Value -Encoding UTF8
  } catch {}
}

$source = @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class CtdJobWatchdog
{
    private const uint JobObjectLimitKillOnJobClose = 0x00002000;
    private const uint ProcessSetQuota = 0x0100;
    private const uint ProcessTerminate = 0x0001;
    private const uint Synchronize = 0x00100000;
    private const uint WaitObject0 = 0;

    [StructLayout(LayoutKind.Sequential)]
    private struct JobObjectBasicLimitInformation
    {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct IoCounters
    {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JobObjectExtendedLimitInformation
    {
        public JobObjectBasicLimitInformation BasicLimitInformation;
        public IoCounters IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateJobObject(IntPtr attributes, string name);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(
        IntPtr job,
        int informationClass,
        IntPtr information,
        uint informationLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(
        uint desiredAccess,
        bool inheritHandle,
        int processId);

    [DllImport("kernel32.dll")]
    private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);

    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);

    private static IntPtr jobHandle = IntPtr.Zero;
    private static IntPtr parentHandle = IntPtr.Zero;

    public static void Create(int parentPid)
    {
        jobHandle = CreateJobObject(IntPtr.Zero, null);
        if (jobHandle == IntPtr.Zero)
        {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "CreateJobObject failed");
        }

        var information = new JobObjectExtendedLimitInformation();
        information.BasicLimitInformation.LimitFlags = JobObjectLimitKillOnJobClose;
        int informationLength = Marshal.SizeOf<JobObjectExtendedLimitInformation>();
        IntPtr informationPointer = Marshal.AllocHGlobal(informationLength);
        try
        {
            Marshal.StructureToPtr(information, informationPointer, false);
            if (!SetInformationJobObject(
                jobHandle,
                9,
                informationPointer,
                (uint)informationLength))
            {
                throw new Win32Exception(
                    Marshal.GetLastWin32Error(),
                    "SetInformationJobObject failed");
            }
        }
        finally
        {
            Marshal.FreeHGlobal(informationPointer);
        }

        parentHandle = OpenProcess(Synchronize, false, parentPid);
        if (parentHandle == IntPtr.Zero)
        {
            throw new Win32Exception(
                Marshal.GetLastWin32Error(),
                "OpenProcess for parent failed");
        }
    }

    public static void Assign(int processId)
    {
        IntPtr processHandle = OpenProcess(
            ProcessSetQuota | ProcessTerminate,
            false,
            processId);
        if (processHandle == IntPtr.Zero)
        {
            throw new Win32Exception(
                Marshal.GetLastWin32Error(),
                "OpenProcess for PTY failed");
        }
        try
        {
            if (!AssignProcessToJobObject(jobHandle, processHandle))
            {
                throw new Win32Exception(
                    Marshal.GetLastWin32Error(),
                    "AssignProcessToJobObject failed");
            }
        }
        finally
        {
            CloseHandle(processHandle);
        }
    }

    public static bool ParentExited(int waitMilliseconds)
    {
        return WaitForSingleObject(parentHandle, (uint)waitMilliseconds) == WaitObject0;
    }

    public static void Close()
    {
        if (parentHandle != IntPtr.Zero)
        {
            CloseHandle(parentHandle);
            parentHandle = IntPtr.Zero;
        }
        if (jobHandle != IntPtr.Zero)
        {
            CloseHandle(jobHandle);
            jobHandle = IntPtr.Zero;
        }
    }
}
'@

$requestsDir = Join-Path $ControlDir 'requests'
$resultsDir = Join-Path $ControlDir 'results'
New-Item -ItemType Directory -Path $requestsDir -Force | Out-Null
New-Item -ItemType Directory -Path $resultsDir -Force | Out-Null

Add-Type -TypeDefinition $source -Language CSharp

try {
  Write-GuardLog "starting parent=$ParentPid"
  [CtdJobWatchdog]::Create($ParentPid)
  Write-GuardLog 'guard-ready'
  Write-GuardStatus 'READY'

  while (-not [CtdJobWatchdog]::ParentExited(100)) {
    Get-ChildItem -LiteralPath $requestsDir -Filter '*.request' -File -ErrorAction SilentlyContinue |
      ForEach-Object {
        $name = [IO.Path]::GetFileNameWithoutExtension($_.Name)
        try {
          $request = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
          [CtdJobWatchdog]::Assign([int]$request.pid)
          Set-Content -LiteralPath (Join-Path $resultsDir "$name.ready") -Value 'READY' -Encoding UTF8
          Write-GuardLog "assigned session=$name pid=$($request.pid)"
        } catch {
          $message = $_.Exception.ToString().Replace("`r", ' ').Replace("`n", ' | ')
          Set-Content -LiteralPath (Join-Path $resultsDir "$name.error") -Value $message -Encoding UTF8
          Write-GuardLog "assign-failed session=$name $message"
        } finally {
          Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
        }
      }
  }
  Write-GuardLog 'parent-exit'
} catch {
  Write-GuardLog "error $($_.Exception.Message)"
  $message = $_.Exception.ToString().Replace("`r", ' ').Replace("`n", ' | ')
  Write-GuardStatus "ERROR: $message"
  exit 1
} finally {
  [CtdJobWatchdog]::Close()
}
