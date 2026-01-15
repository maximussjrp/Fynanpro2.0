#!/bin/bash

# ============================================
# UTOP - Script de Deploy Automatizado
# ============================================
# Uso: ./deploy.sh [comando]
# Comandos: setup | build | up | down | logs | backup | update

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Diretório do projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="/opt/backups/utop"

# Funções de log
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ==================== SETUP INICIAL ====================
setup() {
    log_info "Iniciando setup do UTOP..."
    
    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker não instalado. Instalando..."
        curl -fsSL https://get.docker.com | sh
        sudo usermod -aG docker $USER
        log_warn "Faça logout e login novamente para aplicar permissões do Docker"
        exit 1
    fi
    log_success "Docker instalado"
    
    # Verificar Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose não instalado. Instalando..."
        sudo apt install -y docker-compose
    fi
    log_success "Docker Compose instalado"
    
    # Criar diretório de backups
    sudo mkdir -p $BACKUP_DIR
    sudo chown $USER:$USER $BACKUP_DIR
    log_success "Diretório de backups criado: $BACKUP_DIR"
    
    # Verificar arquivos de ambiente
    if [ ! -f ".env" ]; then
        if [ -f ".env.production.example" ]; then
            cp .env.production.example .env
            log_warn "Arquivo .env criado a partir do exemplo. EDITE COM SEUS VALORES!"
        else
            log_error "Arquivo .env.production.example não encontrado"
            exit 1
        fi
    fi
    
    if [ ! -f "backend/.env.production" ]; then
        if [ -f "backend/.env.production.example" ]; then
            cp backend/.env.production.example backend/.env.production
            log_warn "backend/.env.production criado. EDITE COM SEUS VALORES!"
        fi
    fi
    
    if [ ! -f "frontend/.env.production" ]; then
        if [ -f "frontend/.env.production.example" ]; then
            cp frontend/.env.production.example frontend/.env.production
            log_warn "frontend/.env.production criado. EDITE COM SEUS VALORES!"
        fi
    fi
    
    # Gerar JWT secrets se necessário
    log_info "Gerando JWT secrets..."
    JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    JWT_REFRESH=$(openssl rand -base64 64 | tr -d '\n')
    
    echo ""
    echo "=========================================="
    echo "JWT_SECRET=$JWT_SECRET"
    echo ""
    echo "JWT_REFRESH_SECRET=$JWT_REFRESH"
    echo "=========================================="
    echo ""
    log_warn "Copie esses valores para seu .env e backend/.env.production"
    
    log_success "Setup concluído!"
}

# ==================== BUILD ====================
build() {
    log_info "Fazendo build dos containers..."
    cd $PROJECT_DIR
    docker-compose -f $COMPOSE_FILE build --no-cache
    log_success "Build concluído!"
}

# ==================== UP ====================
up() {
    log_info "Iniciando containers..."
    cd $PROJECT_DIR
    docker-compose -f $COMPOSE_FILE up -d
    
    log_info "Aguardando containers ficarem saudáveis..."
    sleep 10
    
    # Verificar status
    docker-compose -f $COMPOSE_FILE ps
    
    # Verificar health
    log_info "Verificando health do backend..."
    sleep 5
    if curl -s http://localhost:3000/health | grep -q "healthy"; then
        log_success "Backend está saudável!"
    else
        log_warn "Backend ainda iniciando ou com problemas. Verifique os logs."
    fi
    
    log_success "Containers iniciados!"
}

# ==================== DOWN ====================
down() {
    log_info "Parando containers..."
    cd $PROJECT_DIR
    docker-compose -f $COMPOSE_FILE down
    log_success "Containers parados!"
}

# ==================== LOGS ====================
logs() {
    SERVICE=${2:-""}
    if [ -z "$SERVICE" ]; then
        docker-compose -f $COMPOSE_FILE logs -f
    else
        docker-compose -f $COMPOSE_FILE logs -f $SERVICE
    fi
}

# ==================== BACKUP ====================
backup() {
    log_info "Criando backup do banco de dados..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/utop_backup_$TIMESTAMP.sql"
    
    docker exec utop-postgres pg_dump -U utop_user utop > $BACKUP_FILE
    
    # Comprimir
    gzip $BACKUP_FILE
    
    log_success "Backup criado: ${BACKUP_FILE}.gz"
    
    # Limpar backups antigos (manter últimos 7 dias)
    find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
    log_info "Backups antigos removidos (>7 dias)"
}

# ==================== UPDATE ====================
update() {
    log_info "Atualizando UTOP..."
    
    # Backup antes de atualizar
    backup
    
    # Pull das mudanças
    git pull origin main
    
    # Rebuild e restart
    build
    
    # Restart containers
    docker-compose -f $COMPOSE_FILE up -d
    
    # Executar migrations
    log_info "Executando migrations..."
    docker exec utop-backend npx prisma migrate deploy
    
    log_success "Atualização concluída!"
}

# ==================== MIGRATE ====================
migrate() {
    log_info "Executando migrations do Prisma..."
    docker exec utop-backend npx prisma migrate deploy
    log_success "Migrations aplicadas!"
}

# ==================== SEED ====================
seed() {
    log_info "Executando seed do banco..."
    docker exec utop-backend npx prisma db seed
    log_success "Seed executado!"
}

# ==================== STATUS ====================
status() {
    log_info "Status dos containers:"
    docker-compose -f $COMPOSE_FILE ps
    
    echo ""
    log_info "Uso de recursos:"
    docker stats --no-stream
    
    echo ""
    log_info "Health check:"
    curl -s http://localhost:3000/health | jq . 2>/dev/null || curl -s http://localhost:3000/health
}

# ==================== RESTART ====================
restart() {
    SERVICE=${2:-""}
    if [ -z "$SERVICE" ]; then
        log_info "Reiniciando todos os containers..."
        docker-compose -f $COMPOSE_FILE restart
    else
        log_info "Reiniciando $SERVICE..."
        docker-compose -f $COMPOSE_FILE restart $SERVICE
    fi
    log_success "Restart concluído!"
}

# ==================== SHELL ====================
shell() {
    SERVICE=${2:-"backend"}
    log_info "Abrindo shell no container $SERVICE..."
    docker exec -it utop-$SERVICE sh
}

# ==================== HELP ====================
help() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                    UTOP - Deploy Script                   ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    echo "Uso: ./deploy.sh [comando]"
    echo ""
    echo "Comandos disponíveis:"
    echo "  setup     - Configuração inicial do servidor"
    echo "  build     - Build dos containers Docker"
    echo "  up        - Iniciar todos os containers"
    echo "  down      - Parar todos os containers"
    echo "  restart   - Reiniciar containers (ou específico: restart backend)"
    echo "  logs      - Ver logs (ou específico: logs backend)"
    echo "  status    - Ver status dos containers"
    echo "  backup    - Criar backup do banco de dados"
    echo "  update    - Atualizar sistema (git pull + rebuild + migrate)"
    echo "  migrate   - Executar migrations do Prisma"
    echo "  seed      - Executar seed do banco"
    echo "  shell     - Abrir shell no container (default: backend)"
    echo "  help      - Mostrar esta ajuda"
    echo ""
}

# ==================== MAIN ====================
case "$1" in
    setup)   setup ;;
    build)   build ;;
    up)      up ;;
    down)    down ;;
    restart) restart $@ ;;
    logs)    logs $@ ;;
    status)  status ;;
    backup)  backup ;;
    update)  update ;;
    migrate) migrate ;;
    seed)    seed ;;
    shell)   shell $@ ;;
    help)    help ;;
    *)       help ;;
esac
