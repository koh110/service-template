import "@typespec/http";
import "@typespec/openapi";

using Http;

@service(#{ title: "API Specification" })
@TypeSpec.OpenAPI.info(#{ version: "0.0.1" })
namespace MyProducts;

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
