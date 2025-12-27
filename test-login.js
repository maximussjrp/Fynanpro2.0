const http = require("http");
const data = JSON.stringify({email:"master@utopsistema.com.br",password:"Master@2024"});
const options = {
  hostname:"localhost",
  port:3000,
  path:"/api/v1/auth/login",
  method:"POST",
  headers:{"Content-Type":"application/json","Content-Length":data.length}
};
const req = http.request(options, res => {
  let body="";
  res.on("data",chunk=>body+=chunk);
  res.on("end",()=>{
    const json = JSON.parse(body);
    console.log("Status:", json.success ? "OK" : "ERRO");
    if (json.success) {
      console.log("User:", json.data.user.email);
      console.log("Role:", json.data.user.role);
      console.log("Token gerado:", json.data.accessToken ? "SIM" : "NAO");
    } else {
      console.log("Erro:", json.error);
    }
  });
});
req.write(data);
req.end();
