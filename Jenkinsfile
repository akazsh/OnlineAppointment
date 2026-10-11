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
            packageVersion = bat(script: """
              @echo off
              for /f \"delims=\" %I in ('node -p \"require('./package.json').version\" 2^>nul') do @echo %I
            """, returnStdout: true).trim()
            gitCommitShort = bat(script: """
              @echo off
              for /f \"delims=\" %I in ('git rev-parse --short HEAD 2^>nul') do @echo %I
            """, returnStdout: true).trim()
            buildIdentifier = "${packageVersion}-${gitCommitShort}"
            env.BUILD_IDENTIFIER = buildIdentifier
            echo "Build identifier: ${env.BUILD_IDENTIFIER}"
            bat '''
              @echo off
              setlocal enabledelayedexpansion
              if not exist "dist" mkdir "dist"

              for %%F in ("dist\\*.tgz") do del /q "%%~fF"

              npm pack --silent --pack-destination dist
              if errorlevel 1 (
                echo npm pack failed.
                exit /b 1
              )

              set "PKG="
              for /f "delims=" %%F in ('dir /b /a-d "dist\\*.tgz" 2^>nul') do (
                set "PKG=%%~fF"
                goto rename_pkg
              )

              echo No package found in dist after npm pack.
              exit /b 1

              :rename_pkg
              if not defined PKG (
                echo No package found in dist after npm pack.
                exit /b 1
              )
              ren "!PKG!" "appointment-hub-%BUILD_IDENTIFIER%.tgz"
              if errorlevel 1 (
                echo Failed to rename package.
                exit /b 1
              )

              dir /b /a-d "dist\\*.tgz" | findstr /i /c:"appointment-hub-%BUILD_IDENTIFIER%.tgz" >nul
              if errorlevel 1 (
                echo Renamed package not found in dist.
                exit /b 1
              )
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
