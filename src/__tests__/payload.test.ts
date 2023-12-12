import { redactFields, redactHeaders, Payload } from "../payload"

describe("testing headers and jsonpath redaction", () => {
    it("should redact headers correctly", () => {
        const headers: Map<string, string[]> = new Map([
            ["Authorization", ["token"]],
            ["User-Agent", ["MyApp"]],
            ["Content-Type", ["text/json"]],
        ]);

        const headersToRedact = ["Authorization", "content-type"];

        const redactedHeaders = redactHeaders(headers, headersToRedact);

        expect(redactedHeaders["Authorization"]).toEqual(["[CLIENT_REDACTED]"]);
        expect(redactedHeaders["Content-Type"]).toEqual(["[CLIENT_REDACTED]"]);
        expect(redactedHeaders["User-Agent"]).toEqual(["MyApp"]);
    });

    it("should redact fields correctly", () => {
        const body =
            '{"user": {"name": "John", "email": "john@example.com", "books": [{"title": "Book 1", "author": "Author 1"},{"title": "Book 2", "author": "Author 2"}]}}';
        const fieldsToRedact = ["$.user.email", "user.books[*].author"];

        const redactedBody = redactFields(body, fieldsToRedact);

        expect(redactedBody).toContain('"email":"[CLIENT_REDACTED]"');
        expect(redactedBody).toContain(
            '{"title":"Book 1","author":"[CLIENT_REDACTED]"},{"title":"Book 2","author":"[CLIENT_REDACTED]"}',
        );
        expect(redactedBody).toContain('"name":"John"');
    });
});