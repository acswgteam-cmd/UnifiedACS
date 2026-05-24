export function getOffHourStatus(currentDate = new Date()): { show: boolean; message: string } {
  const dayOfWeek = currentDate.getDay(); // 0 is Sunday, 6 is Saturday
  const hour = currentDate.getHours();
  
  // Format YYYY-MM-DD
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;

  const holidays = [
    // 2024
    "2024-01-01", "2024-02-08", "2024-02-10", "2024-03-11", "2024-03-29", "2024-04-10", "2024-04-11", "2024-05-01", "2024-05-09", "2024-05-23", "2024-06-01", "2024-06-17", "2024-07-07", "2024-08-17", "2024-09-16", "2024-12-25",
    // 2025
    "2025-01-01", "2025-01-27", "2025-01-29", "2025-03-29", "2025-03-31", "2025-04-01", "2025-04-18", "2025-05-01", "2025-05-12", "2025-05-29", "2025-06-01", "2025-06-06", "2025-06-27", "2025-08-17", "2025-09-05", "2025-12-25",
    // 2026
    "2026-01-01", "2026-01-16", "2026-02-17", "2026-03-19", "2026-03-20", "2026-03-21", "2026-04-03", "2026-05-01", "2026-05-14", "2026-05-27", "2026-05-31", "2026-06-01", "2026-06-16", "2026-08-17", "2026-08-25", "2026-12-25"
  ];

  // 1. Weekend or Holiday
  if (dayOfWeek === 0 || dayOfWeek === 6 || holidays.includes(dateString)) {
    return {
      show: true,
      message: "Respon dari request anda akan di follow up pada hari kerja, akan terjadi sedikit penundaan saat memasukan request pada Hari Libur."
    };
  }

  // 2. Weekday Out of Office Hours (>= 17:00 or < 09:00)
  if (hour >= 17 || hour < 9) {
    return {
      show: true,
      message: "request anda akan di follow up kemudian hari karena sudah mendekati/ melebihi jam kerja. jam kerja kami jam 9 pagi sampai 6 sore."
    };
  }

  return { show: false, message: "" };
}
