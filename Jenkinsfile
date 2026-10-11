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

    stage('Unit Tests') {
      steps {
        script {
          if (isUnix()) {
            sh 'npm test'
          } else {
            bat 'npm test'
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
          def packageVersion
          def gitCommitShort
          def buildIdentifier

          if (isUnix()) {
            packageVersion = sh(script: 'node -p "require(\'./package.json\').version"', returnStdout: true).trim()
            gitCommitShort = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
            buildIdentifier = "${packageVersion}-${gitCommitShort}"
            env.BUILD_IDENTIFIER = buildIdentifier
            echo "Build identifier: ${env.BUILD_IDENTIFIER}"
            sh 'mkdir -p dist'
            sh 'npm pack --silent --pack-destination dist'
            sh "mv dist/*.tgz \"dist/appointment-hub-${env.BUILD_IDENTIFIER}.tgz\""
          } else {
            packageVersion = bat(script: "node -p \"require('./package.json').version\"", returnStdout: true).trim()
            gitCommitShort = bat(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
            buildIdentifier = "${packageVersion}-${gitCommitShort}"
            env.BUILD_IDENTIFIER = buildIdentifier
            echo "Build identifier: ${env.BUILD_IDENTIFIER}"
            bat '''
              setlocal enabledelayedexpansion
              if not exist "dist" mkdir "dist"
              npm pack --silent --pack-destination dist
              for /f "delims=" %%F in ('dir /b /a-d "dist\\*.tgz" 2^>nul') do (
                set "PKG=%%~fF"
                ren "!PKG!" "appointment-hub-%BUILD_IDENTIFIER%.tgz"
                exit /b 0
              )
              echo No package found in dist after npm pack.
              exit /b 1
            '''
          }
        }
      }
      post {
        success {
          archiveArtifacts artifacts: 'dist/*.tgz', fingerprint: true
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
