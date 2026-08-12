import "@typespec/http";
import "@typespec/openapi";
import "./typespec/user.tsp";

using Http;

@service(#{ title: "API Specification" })
@TypeSpec.OpenAPI.info(#{ version: "0.0.1" })
namespace MyProducts;

/** RFC 9457 Problem Details for HTTP APIs */
@error
model BadRequestError {
  type: string;
  title: string;
  status: 400;
  detail?: string;
}

/** RFC 9457 Problem Details for HTTP APIs */
@error
model UnauthorizedError {
  type: string;
  title: string;
  status: 401;
  detail?: string;
}

/** RFC 9457 Problem Details for HTTP APIs */
@error
model ForbiddenError {
  type: string;
  title: string;
  status: 403;
  detail?: string;
}

/** RFC 9457 Problem Details for HTTP APIs */
@error
model NotFoundError {
  type: string;
  title: string;
  status: 404;
  detail?: string;
}

/** RFC 9457 Problem Details for HTTP APIs */
@error
model ConflictError {
  type: string;
  title: string;
  status: 409;
  detail?: string;
}

/** RFC 9457 Problem Details for HTTP APIs */
@error
model InternalServerError {
  type: string;
  title: string;
  status: 500;
  detail?: string;
}

@route("/healthcheck")
interface HealthCheckApi {
  /** This endpoint is used for ALB Target Group Healthcheck */
  @tag("Healthcheck")
  @summary("healthcheck")
  @get
  healthcheck(): {
    @statusCode statusCode: 200;
    @body body: "ok";
  };
}
