**1. Usage Instructions**

- **Setup:**
  - Ensure Node.js is installed.
  - Install dependencies: `npm install`

- **Execution:**
  - Run the program: `node index.js`
  - Follow prompts to select operation
  - or run `npm link` to link the package globally and use it from anywhere in the terminal.
  - run `historytree` to start

**2. Directory Structure**
- `.gitignore`: Specifies files to ignore in version control.
- `index.js`: Main program file.
- `package-lock.json` & `package.json`: Manage dependencies.
- `README.md`: This file

**3. Examples**

**Snapshot Current Directory**

```
Final JSON info + tree 
{
	info: ... , 
	tree: ...
}
```

**Init History**

**4. Road Map**
- Add more features like:
  - [x] Customizable history depth
  - [ ] Global config file to store list of all tracked directories on a device
  - [ ] Create an info file with the full path of the directory on the host system 
  - [ ] Add option to not commit the changes to git
  - [ ] CLI flags to control behavior 
    - [ ] Add CLI option to configure skipped directories (e.g., `node_modules`)
    - `--no-git` to skip git commit
    - `--depth` to specify history depth
    - `--format` to specify export format (e.g., JSON, XML)
    - `--output` to specify output file name
    - `--help` for usage instructions
    - `--version` to check the version of the tool
    - `--verbose` for detailed output
  - [ ] Support for more export file formats (ex: XML)
  - [ ] Improved error handling and user feedback


