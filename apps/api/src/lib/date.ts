const BANGKOK_TIME_ZONE = "Asia/Bangkok";

export function getBangkokDateStamp(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIME_ZONE,
  }).format(date);
}
