#!/bin/bash
# Backup automático do banco de dados UTOP
# Executado diariamente pelo cron

BACKUP_DIR="/opt/utop/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/utop_backup_$DATE.sql"
LOG_FILE="/var/log/utop_backup.log"

# Criar diretório de backup se não existir
mkdir -p $BACKUP_DIR

# Log início
echo "[$(date)] Iniciando backup..." >> $LOG_FILE

# Fazer backup
docker exec utop-postgres pg_dump -U utop_user -d utop > $BACKUP_FILE 2>> $LOG_FILE

if [ $? -eq 0 ]; then
    # Comprimir backup
    gzip $BACKUP_FILE
    echo "[$(date)] Backup concluído: $BACKUP_FILE.gz" >> $LOG_FILE
    
    # Manter apenas os últimos 30 backups
    ls -t $BACKUP_DIR/utop_backup_*.sql.gz | tail -n +31 | xargs -r rm
    echo "[$(date)] Limpeza de backups antigos concluída" >> $LOG_FILE
else
    echo "[$(date)] ERRO no backup!" >> $LOG_FILE
fi
