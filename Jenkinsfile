pipeline {
  agent any

  environment {
    NODE_ENV = 'test'
  }

  stages {
    stage('Check Node.js') {
      steps {
        script {
          if (isUnix()) {
            sh 'node --version'
            sh 'npm --version'
            sh 'node -e "if (parseInt(process.versions.node, 10) < 18) process.exit(1)"'
          } else {
            bat 'node --version'
            bat 'npm --version'
            bat 'node -e "if (parseInt(process.versions.node, 10) < 18) process.exit(1)"'
          }
        }
      }
    }

    stage('Install dependencies') {
      steps {
        script {
          if (isUnix()) {
            sh 'npm ci --no-audit --no-fund'
          } else {
            bat 'npm ci --no-audit --no-fund'
          }
        }
      }
    }

    stage('Validate application') {
      steps {
        script {
          if (isUnix()) {
            sh 'node --check server.js'
          } else {
            bat 'node --check server.js'
          }
        }
      }
    }

    stage('Package app') {
      steps {
        script {
          if (isUnix()) {
            sh 'npm pack --silent'
          } else {
            bat 'npm pack --silent'
          }
        }
      }
      post {
        success {
          archiveArtifacts artifacts: '*.tgz', fingerprint: true
        }
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
