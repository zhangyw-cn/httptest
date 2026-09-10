export function methodClass(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "get";
    case "POST":
      return "post";
    case "PUT":
      return "put";
    case "PATCH":
      return "patch";
    case "DELETE":
      return "delete";
    default:
      return "muted";
  }
}
