use serde::Serialize;
use std::{
    ffi::{CStr, CString},
    path::Path,
};

#[derive(Serialize)]
pub struct Host {
    pub hostname: Option<String>,
    pub disk_path: String,
    pub disk_total_bytes: Option<u64>,
    pub disk_available_bytes: Option<u64>,
    pub memory_total_bytes: Option<u64>,
    pub memory_available_bytes: Option<u64>,
    pub swap_total_bytes: Option<u64>,
    pub swap_free_bytes: Option<u64>,
    pub load_average: Option<[f64; 3]>,
    pub cpu_count: Option<usize>,
    pub uptime_seconds: Option<u64>,
}

pub fn collect(path: &Path) -> Host {
    let mut result = Host {
        hostname: None,
        disk_path: path.display().to_string(),
        disk_total_bytes: None,
        disk_available_bytes: None,
        memory_total_bytes: None,
        memory_available_bytes: None,
        swap_total_bytes: None,
        swap_free_bytes: None,
        load_average: None,
        cpu_count: std::thread::available_parallelism().ok().map(usize::from),
        uptime_seconds: None,
    };
    #[cfg(unix)]
    {
        let mut hostname = [0 as libc::c_char; 256];
        // OS calls write only into correctly sized initialized buffers. Every field remains null on failure.
        if unsafe { libc::gethostname(hostname.as_mut_ptr(), hostname.len() - 1) } == 0 {
            result.hostname = unsafe { CStr::from_ptr(hostname.as_ptr()) }
                .to_str()
                .ok()
                .map(str::to_owned);
        }
        let mut loads = [0.0; 3];
        if unsafe { libc::getloadavg(loads.as_mut_ptr(), 3) } == 3 {
            result.load_average = Some(loads);
        }
        if let Ok(path) = CString::new(path.as_os_str().as_encoded_bytes()) {
            let mut stat = std::mem::MaybeUninit::<libc::statvfs>::uninit();
            if unsafe { libc::statvfs(path.as_ptr(), stat.as_mut_ptr()) } == 0 {
                let stat = unsafe { stat.assume_init() };
                // statvfs integer widths differ across Unix platforms.
                result.disk_total_bytes =
                    u64::try_from(u128::from(stat.f_blocks) * u128::from(stat.f_frsize)).ok();
                result.disk_available_bytes =
                    u64::try_from(u128::from(stat.f_bavail) * u128::from(stat.f_frsize)).ok();
            }
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(mem) = std::fs::read_to_string("/proc/meminfo") {
            result.memory_total_bytes = meminfo(&mem, "MemTotal:");
            result.memory_available_bytes = meminfo(&mem, "MemAvailable:");
            result.swap_total_bytes = meminfo(&mem, "SwapTotal:");
            result.swap_free_bytes = meminfo(&mem, "SwapFree:");
        }
        result.uptime_seconds = std::fs::read_to_string("/proc/uptime")
            .ok()
            .and_then(|s| s.split_whitespace().next()?.parse::<f64>().ok())
            .map(|v| v as u64);
    }
    #[cfg(target_os = "macos")]
    {
        let mut total = 0_u64;
        let mut size = std::mem::size_of::<u64>();
        if unsafe {
            libc::sysctlbyname(
                c"hw.memsize".as_ptr(),
                (&mut total as *mut u64).cast(),
                &mut size,
                std::ptr::null_mut(),
                0,
            )
        } == 0
        {
            result.memory_total_bytes = Some(total);
        }
        let mut swap = std::mem::MaybeUninit::<libc::xsw_usage>::uninit();
        let mut size = std::mem::size_of::<libc::xsw_usage>();
        if unsafe {
            libc::sysctlbyname(
                c"vm.swapusage".as_ptr(),
                swap.as_mut_ptr().cast(),
                &mut size,
                std::ptr::null_mut(),
                0,
            )
        } == 0
        {
            let swap = unsafe { swap.assume_init() };
            result.swap_total_bytes = Some(swap.xsu_total);
            result.swap_free_bytes = Some(swap.xsu_avail);
        }
        let mut boot = std::mem::MaybeUninit::<libc::timeval>::uninit();
        let mut size = std::mem::size_of::<libc::timeval>();
        if unsafe {
            libc::sysctlbyname(
                c"kern.boottime".as_ptr(),
                boot.as_mut_ptr().cast(),
                &mut size,
                std::ptr::null_mut(),
                0,
            )
        } == 0
        {
            let boot = unsafe { boot.assume_init() };
            result.uptime_seconds = chrono::Utc::now()
                .timestamp()
                .checked_sub(boot.tv_sec)
                .and_then(|v| v.try_into().ok());
        }
    }
    result
}

#[cfg(any(target_os = "linux", test))]
fn meminfo(contents: &str, name: &str) -> Option<u64> {
    contents.lines().find_map(|line| {
        let mut fields = line.split_whitespace();
        if fields.next()? != name {
            return None;
        }
        fields.next()?.parse::<u64>().ok()?.checked_mul(1024)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn unavailable_disk_is_null_and_memory_units_are_bytes() {
        let host = collect(Path::new("/this-path-must-not-exist/admin-metrics"));
        assert_eq!(host.disk_total_bytes, None);
        assert_eq!(
            meminfo("MemTotal: 1024 kB\nMemAvailable: 100 kB", "MemTotal:"),
            Some(1_048_576)
        );
        assert_eq!(meminfo("", "MemAvailable:"), None);
    }
}
