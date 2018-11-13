# Unofficial Veracode Greenlight for Java

## Features

Rapid static analysis of Java files.

## Requirements

A Veracode API credentials account with id/key saved in `~/.veracode/credentials`

```
[default]
veracode_api_key_id = 359edffad5....
veracode_api_key_secret = 09fafebf9e1f3490....
```

## Installation

Download .vsix file from releases tab or install from VS Code Marketplace

## Extension Settings

This extension contributes the following settings:

* `greenlightJava.sourceFolder`: Java source files root folder, default `src/main/java`
* `greenlightJava.classFolder`: Java compiled class files root folder, default `target/classes`
* `greenlightJava.authProfile`: Veracode authentication profile section from ~/.veracode/credentials, default `default`

## Known Issues

None

## Release Notes

### 1.0.0

Initial release of Unofficial Veracode Greenlight for Java
