// stub สำหรับทดสอบในเครื่อง (ไม่เชื่อมเน็ต)
class JWT { async getAccessToken() { return { token: "test-token" }; } }
const ExternalAccountClient = { fromJSON() { return new JWT(); } };
module.exports = { JWT, ExternalAccountClient };
