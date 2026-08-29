/** GitHub project pages live below /Repository/, while custom domains use /. */
export function normalizeBasePath(input: string): string {
  const value=input.trim().replace(/\/$/, "");
  if(!value)return "";
  if(!/^\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(value)||value.split("/").some(p=>p==="."||p==="..")) {
    throw new Error("KAIRO_BASE_PATH must be empty or a path such as /Kairo-Ride.");
  }
  return value;
}

export const BASE_PATH=normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH??"");
export const appPath=(file="")=>`${BASE_PATH}/${file.replace(/^\/+/,"")}`;
// Two different GitHub Pages projects on one origin must not share local records.
// The root name is unchanged so existing root-hosted local data stays readable.
export const LOCAL_DATABASE=BASE_PATH?`kairo-ride-v1@${BASE_PATH}`:"kairo-ride-v1";
export const LOCAL_CHANNEL=BASE_PATH?`kairo-ride@${BASE_PATH}`:"kairo-ride";
