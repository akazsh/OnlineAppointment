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
          if (isUnix()) {
            def packageVersion = sh(
              script: 'node -p "require(\'./package.json\').version"',
              returnStdout: true
            ).trim()

            def gitCommitShort = sh(
              script: 'git rev-parse --short HEAD',
              returnStdout: true
            ).trim()

            env.BUILD_IDENTIFIER = "${packageVersion}-${gitCommitShort}"
            echo "Build identifier: ${env.BUILD_IDENTIFIER}"

            sh 'mkdir -p dist'
            sh 'npm pack --silent --pack-destination dist'
            sh "mv dist/*.tgz \"dist/appointment-hub-${env.BUILD_IDENTIFIER}.tgz\""
          } else {
            bat '''
              @echo off
              if not exist "dist" mkdir "dist"
              del /f /q "dist\\*.tgz" 2>nul
            '''

            def packageVersion = powershell(
              script: "(node -p \"require('./package.json').version\").Trim()",
              returnStdout: true
            ).trim()

            def gitCommitShort = powershell(
              script: "(git rev-parse --short HEAD).Trim()",
              returnStdout: true
            ).trim()

            env.BUILD_IDENTIFIER = "${packageVersion}-${gitCommitShort}"
            echo "Build identifier: ${env.BUILD_IDENTIFIER}"

            bat '''
              @echo off
              call npm pack --silent --pack-destination dist
              if errorlevel 1 exit /b 1
            '''

            powershell '''
              $ErrorActionPreference = "Stop"
              $files = @(Get-ChildItem -Path "dist" -Filter "*.tgz" -File)
              if ($files.Count -ne 1) {
                throw "Expected exactly one package in dist, found $($files.Count)"
              }
              $target = "appointment-hub-$env:BUILD_IDENTIFIER.tgz"
              $destination = Join-Path -Path $files[0].DirectoryName -ChildPath $target
              Rename-Item -LiteralPath $files[0].FullName -NewName $target
              if (-not (Test-Path -LiteralPath $destination -PathType Leaf)) {
                throw "Versioned package was not created."
              }
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
