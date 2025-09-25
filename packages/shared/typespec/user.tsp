import "@typespec/http";

using Http;
namespace MyProducts;

@route("/api/user")
interface User {
  @get listUser(@header("Authorization") auth: string): {
    @statusCode statusCode: 200;
    @body body: {
      count: integer;
      user: {
        id: integer;
        name: string;

        @doc("unix timestamp seconds")
        created_at: integer;

        @doc("unix timestamp seconds")
        updated_at: integer;
      }[];
    };
  };

  @route("/{id}")
  @put
  updateUser(
    @header("Authorization") auth: string,
    @path id: integer,
    @body body: {
      name?: string;
    },
  ):
    | {
        @statusCode statusCode: 200;
        @body body: {
          message: string;
        };
      }
    | {
        @statusCode statusCode: 400;
        @body body: {
          message: string;
          cause: string;
        };
      }
    | {
        @statusCode statusCode: 401;
        @body body: {
          message: string;
          cause: string;
        };
      }
    | {
        @statusCode statusCode: 403;
        @body body: {
          message: string;
          cause: string;
        };
      }
    | {
        @statusCode statusCode: 404;
        @body body: {
          message: string;
        };
      }
    | {
        @statusCode statusCode: 500;
        @body body: {
          message: string;
        };
      };
}
