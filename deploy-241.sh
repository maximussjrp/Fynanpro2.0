#!/bin/bash
# FASE 2.4.1 Deploy Script

# Find the project directory
PROJECT_DIR=$(find /home -maxdepth 3 -name "docker-compose.yml" -exec dirname {} \; 2>/dev/null | head -1)

if [ -z "$PROJECT_DIR" ]; then
  PROJECT_DIR=$(find /opt -maxdepth 3 -name "docker-compose.yml" -exec dirname {} \; 2>/dev/null | head -1)
fi

if [ -z "$PROJECT_DIR" ]; then
  echo "Could not find project directory"
  echo "Checking docker-compose from running containers..."
  
  # Try to rebuild from git directly in container
  docker exec utop-backend bash -c "cd /app && git pull origin main 2>/dev/null || echo 'Git not available in container'"
  
  # Check if we need to rebuild
  echo "Rebuilding containers..."
  
  # Find where the project is
  COMPOSE_FILE=$(docker inspect utop-backend --format='{{index .Config.Labels "com.docker.compose.project.config_files"}}' 2>/dev/null)
  echo "Compose file: $COMPOSE_FILE"
  
  if [ -n "$COMPOSE_FILE" ]; then
    cd $(dirname "$COMPOSE_FILE")
    echo "Project dir: $(pwd)"
    git pull origin main
    docker-compose up -d --build backend frontend
  fi
else
  echo "Found project at: $PROJECT_DIR"
  cd "$PROJECT_DIR"
  git pull origin main
  docker-compose up -d --build backend frontend
fi

echo "Done!"
