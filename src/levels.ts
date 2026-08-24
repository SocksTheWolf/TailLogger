//debug, info, log, warn, error.
export const getLogLevel = (checkWith: string): number => {
  switch(checkWith) {
    case "error":
      return 5;
    case "warn":
      return 4;
    case "log":
      return 3;
    case "info":
      return 2;
    case "debug":
      return 1;
    default:
      return 0;
  }
}

export const getColorLevel = (logLevel: string): number => {
  switch(logLevel) {
    case "error":
      return 14291731;
    case "warn":
      return 16094468;
    default:
    case "log":
      return 16777215;
    case "info":
      return 5174780;
    case "debug":
      return 13426896;
  }
}