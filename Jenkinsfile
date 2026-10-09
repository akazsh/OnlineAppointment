pipeline {
  agent any

  environment {
    NODE_ENV = 'test'
  }

  tools {
    nodejs 'NodeJS 18'
  }

  stages {
    stage('Install dependencies') {
      steps {
        sh 'npm ci --no-audit --no-fund'
      }
    }

    stage('Validate application') {
      steps {
        sh 'node --check server.js'
      }
    }

    stage('Package app') {
      steps {
        sh 'npm pack --silent'
      }
    }
  }

  post {
    success {
      echo 'Build completed successfully.'
    }
    failure {
      echo 'Build failed. Check the console output for details.'
    }
  }
}
