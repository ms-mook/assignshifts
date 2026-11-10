exports.NextResponse = { json: (body, init) => ({ status: (init && init.status) || 200, body, json: async () => body }) };
