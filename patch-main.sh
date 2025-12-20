#!/bin/sh
# Adicionar import do subscription
sed -i '28i const subscription_1 = __importDefault(require("./routes/subscription"));' /app/dist/main.js

# Adicionar a rota de subscription após planning
sed -i '/apiRouter.use.*planning_1.default/a apiRouter.use("/subscription", subscription_1.default);' /app/dist/main.js

echo "Patch aplicado!"
