# Arquivos de certificado SSL
# Estes arquivos serão gerados pelo Certbot/Let's Encrypt
# NÃO COMMITAR CERTIFICADOS NO GIT!

# Instruções:
# 1. Em produção, use Certbot para gerar certificados:
#    certbot certonly --standalone -d api.utop.com.br -d app.utop.com.br
#
# 2. Copie os certificados para esta pasta:
#    cp /etc/letsencrypt/live/utop.com.br/fullchain.pem ./nginx/certs/
#    cp /etc/letsencrypt/live/utop.com.br/privkey.pem ./nginx/certs/
#
# 3. Para renovar automaticamente, adicione ao crontab:
#    0 0 1 * * certbot renew && docker-compose -f docker-compose.prod.yml restart nginx
