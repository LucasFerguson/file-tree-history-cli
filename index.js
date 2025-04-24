#!/usr/bin/env node

import chalk from 'chalk';
import figlet from 'figlet';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import fs from 'fs';

async function showMainMenu() {
	console.log(chalk.green(
		figlet.textSync('Tree History CLI', { horizontalLayout: 'full' })
	));

	console.log(chalk.blue('Created by Lucas.'));
	console.log(chalk.gray('Some fields have Gray default values, press Enter to accept.'));

	const { operation } = await inquirer.prompt({
		type: 'list',
		name: 'operation',
		message: 'Choose operation:',
		choices: ['Snapshot Current Directory', 'Init History', 'Exit']
	});

	if (operation === 'Exit') {
		process.exit(0)

	} else if (operation === 'Snapshot Current Directory') {
		await snapshot();
		console.log(chalk.green('Snapshot created!'));

	} else if (operation === 'Init History') {
		await initHistory();
		console.log(chalk.green('History initialized!'));
	}

	// console.log(chalk.yellow('\nAlgorithm:'), algorithm);
	// console.log(chalk.yellow('Operation:'), operation);
	// console.log(chalk.yellow('Text:'), text);

	console.log('');

	// await inquirer.prompt({
	// 	type: 'input',
	// 	name: 'continue',
	// 	message: 'Press Enter to continue...'
	// });

	// await showMainMenu();
}

console.clear();
showMainMenu().catch(error => {
	// debugging stuff
	console.error(chalk.red('Fatal error:'), error);
});

async function snapshot() {
	try {
		const timestamp = new Date().toISOString().replace(/[:]/g, '-');
		const header = `Snapshot created at: ${timestamp}\n${'='.repeat(50)}\n\n`;

		// Check if folder_history exists, if not prompt for initialization
		if (!fs.existsSync('folder_history')) {
			const { shouldInit } = await inquirer.prompt({
				type: 'confirm',
				name: 'shouldInit',
				message: 'Directory is not initialized. Would you like to initialize it now?',
				default: true
			});

			if (shouldInit) {
				initHistory();
			} else {
				console.log(chalk.yellow('Snapshot cancelled. Please initialize directory first.'));
				return;
			}
		}

		// Check for required directory structure and files
		if (!fs.existsSync('folder_history/snapshots')) {
			console.error(chalk.red('Error: snapshots directory is missing. Please re-initialize.'));
			return;
		}

		if (!fs.existsSync('folder_history/.gitignore')) {
			console.error(chalk.red('Error: .gitignore is missing. Please re-initialize.'));
			return;
		}

		const gitignoreContent = fs.readFileSync('folder_history/.gitignore', 'utf8');
		if (!gitignoreContent.includes('snapshots/')) {
			console.error(chalk.red('Error: .gitignore is invalid. Please re-initialize.'));
			return;
		}

		function buildTreeJson(dir) {
			let tree = { name: dir.split('/').pop(), type: 'dir', size: 0, children: [] };
			let items;

			try {
				items = fs.readdirSync(dir);
			} catch (error) {
				console.error(chalk.yellow(`Warning: Could not read directory ${dir}: ${error.message}`));
				return {
					name: dir.split('/').pop(),
					type: 'dir',
					size: 0,
					children: [{
						name: "Access denied",
						type: 'file',
						size: 0
					}]
				};
			}

			for (const item of items) {
				const path = `${dir}/${item}`;
				let stats;

				try {
					stats = fs.statSync(path);
				} catch (error) {
					console.error(chalk.yellow(`Warning: Could not access ${path}: ${error.message}`));
					tree.children.push({
						name: `${item} (inaccessible)`,
						type: 'file',
						size: 0
					});
					continue;
				}

				if (item === 'node_modules' || item === 'folder_history' || item === '.git' || item === 'venv' || item === '__pycache__' || item === 'venv-ubuntu' || item === 'android') {
					tree.children.push({
						name: item,
						type: 'dir',
						size: 0,
						children: [{
							name: "Directory skipped",
							type: 'file',
							size: 0
						}]
					});
					continue;
				}

				if (stats.isDirectory()) {
					const subtree = buildTreeJson(path);
					tree.size += subtree.size;
					tree.children.push(subtree);
				} else {
					tree.children.push({
						name: item,
						type: 'file',
						size: stats.size
					});
					tree.size += stats.size;
				}
			}

			return tree;
		}

		function formatSize(bytes) {
			const units = ['B', 'KB', 'MB', 'GB'];
			let size = bytes;
			let unitIndex = 0;
			while (size >= 1024 && unitIndex < units.length - 1) {
				size /= 1024;
				unitIndex++;
			}
			// Format to 8 characters total: 6 for number (including decimal) and 2 for unit
			return `${size.toFixed(1).padStart(6)}${units[unitIndex].padEnd(2)}`;
		}

		// Converts a tree node structure into a string representation
		function treeToString(node, prefix = '', isLast) {
			// Initialize array to store tree lines
			let output = [];
			// Format the size of current node (file/directory)
			const nodeSize = formatSize(node.size);
			let itemPrefix = isLast ? '└───' : '├───';

			if (node.type === 'dir') {
				// For directories: show name and total size
				// Special case: rename '.' to 'ROOT' for the root directory
				output.push(`(${nodeSize}) ${prefix}${itemPrefix}${node.name === '.' ? 'ROOT' : node.name}`);

				// Process each child in the directory
				node.children.forEach((child, index) => {
					// Create indentation for child items
					// You can modify these symbols to use different characters
					const childPrefix = prefix + "│   "; // (isLast ? '    └───' : '    ├───')
					// Recursively process child nodes
					const isLast = index === node.children.length - 1;
					output = output.concat(treeToString(child, childPrefix, isLast));
				});
			} else {
				// For files: show filename and size
				output.push(`(${nodeSize}) ${prefix}${itemPrefix}${node.name}`);
			}

			return output;
		}

		// Build tree structure
		const treeJson = buildTreeJson('.');
		const treeContent = treeToString(treeJson);

		console.log(chalk.blue('Tree structure created!'));
		console.log(chalk.blue('Writing files...'));
		// Write files in folder_history directory
		fs.writeFileSync(
			`folder_history/snapshots/tree_snapshot_${timestamp}.txt`,
			header + treeContent.join('\n')
		);

		fs.writeFileSync(
			`folder_history/snapshots/tree_snapshot_${timestamp}.json`,
			JSON.stringify(treeJson, null, 2)
		);

		// Write files in folder_history directory
		fs.writeFileSync(
			`folder_history/tree.txt`,
			header + treeContent.join('\n')
		);

		fs.writeFileSync(
			`folder_history/tree.json`,
			JSON.stringify(treeJson, null, 2)
		);

		// Add and commit changes to git repository
		process.chdir('folder_history');
		execSync('git add .', { stdio: 'inherit' });
		execSync(`git commit -m "Snapshot created ${timestamp}"`, { stdio: 'inherit' });
		process.chdir('..');

	} catch (error) {
		console.error(chalk.red('Error creating snapshot:'), error.message);
	}
}

async function initHistory() {
	try {
		// Check if folder_history directory exists
		if (!fs.existsSync('folder_history')) {
			fs.mkdirSync('folder_history');
		}

		// Create .gitignore file to ignore snapshots folder
		fs.writeFileSync('folder_history/.gitignore', 'snapshots/');

		// Create snapshots directory if it doesn't exist
		if (!fs.existsSync('folder_history/snapshots')) {
			fs.mkdirSync('folder_history/snapshots');
		}

		// Initialize git repository in folder_history directory
		execSync('git init folder_history', { stdio: 'inherit' });

		console.log(chalk.blue('Attempting to make initial commit...'));
		try {
			process.chdir('folder_history');
			execSync('git add .', { stdio: 'inherit' });
			execSync('git commit -m "Initial commit"', { stdio: 'inherit' });
			process.chdir('..');
		} catch (error) {
			console.log(chalk.yellow('Failed to make initial commit.'));
			console.log(chalk.gray('Error details:', error.message));
			console.log(chalk.gray('\nCommon causes:'));
			console.log(chalk.gray('1. Git repository ownership/permission issues'));
			console.log(chalk.gray('2. Git user/email not configured'));
			console.log(chalk.gray('3. Network or access restrictions'));

			const { shouldConfigure } = await inquirer.prompt({
				type: 'confirm',
				name: 'shouldConfigure',
				message: 'Would you like to try fixing Git directory permissions by adding the directory\'s path to Git\'s "safe directory" list. This tells Git to ignore ownership checks for that specific directory?',
				default: true
			});

			if (shouldConfigure) {
				console.log(chalk.blue('Running command: git config --global --add safe.directory "*"'));
				execSync('git config --global --add safe.directory "*"', { stdio: 'inherit' });

				console.log(chalk.blue('Running command: git -C folder_history config core.fileMode false'));
				execSync('git -C folder_history config core.fileMode false', { stdio: 'inherit' });

				console.log(chalk.green('Git configured successfully! Repository permissions updated.'));
			}
		}

		console.log(chalk.green('Git repository initialized in folder_history!'));
	} catch (error) {
		console.error(chalk.red('Error initializing history:'), error.message);
	}
}