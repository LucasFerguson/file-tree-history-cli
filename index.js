#!/usr/bin/env node

import chalk from 'chalk';
import figlet from 'figlet';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { Worker } from 'worker_threads';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
		choices: ['Snapshot Current Directory', 'Init History', 'History Stats', 'Exit']
	});

	if (operation === 'Exit') {
		process.exit(0)

	} else if (operation === 'Snapshot Current Directory') {
		await snapshot();
		console.log(chalk.green('Snapshot created! Function snapshot() finished executing'));

	} else if (operation === 'Init History') {
		await initHistory();
		console.log(chalk.green('History initialized! Function initHistory() finished executing'));
	} else if (operation === 'History Stats') {
		await historyStats();
		console.log(chalk.green('History stats displayed! Function historyStats() finished executing'));
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

		console.log(chalk.blue('Building tree structure... Press Ctrl+C to cancel.'));
		// Start Directory Scanner - Build tree structure
		// const treeJson = buildTreeJson('.');
		let dir = '.'; // Default to current directory
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);
		const workerPath = join(__dirname, 'scanner-worker.js');

		const worker = new Worker(workerPath, { workerData: { dir } });

		worker.on('message', (msg) => {
			switch (msg.status) {
				case 'start':
					console.log(`Scanning ${msg.dir}...`);
					break;
				case 'progress': // Add progress events to scanner
					console.log(`Scanned ${msg.currentItem} (${msg.percent}%)`);
					break;
				case 'complete':
					console.log('Done!');
					// Use msg.tree
					break;
				case 'error':
					console.error(`Failed: ${msg.error}`);
					break;
			}
		});
		// await worker finished
		const { tree } = await new Promise((resolve, reject) => {
			worker.on('message', (msg) => {
				if (msg.status === 'complete') {
					resolve(msg);
				} else if (msg.status === 'error') {
					reject(new Error(msg.error));
				}
			});
		});

		console.log("treeJson = ", tree);

		const treeContent = treeToString(tree);

		console.log(chalk.blue('Tree structure created!'));
		console.log(chalk.blue('Writing files...'));
		
		// Final JSON info + tree 
		// {
		// 	info: ... , 
		// 	tree: ...
		// }

		let header = `Snapshot created at: ${timestamp}\n${'='.repeat(50)}\n\n`;
		let currentDirectory = process.cwd()
		header += `Current Directory: ${currentDirectory}\n`;

		let finalJson = {
			info: {
				currentDirectory: currentDirectory
			},
			tree: tree,
		}

		// Write files in folder_history directory
		fs.writeFileSync(
			`folder_history/snapshots/tree_snapshot_${timestamp}.txt`,
			header + treeContent.join('\n')
		);

		fs.writeFileSync(
			`folder_history/snapshots/tree_snapshot_${timestamp}.json`,
			JSON.stringify(finalJson, null, 2)
		);

		// Write files in folder_history directory
		fs.writeFileSync(
			`folder_history/tree.txt`,
			header + treeContent.join('\n')
		);

		fs.writeFileSync(
			`folder_history/tree.json`,
			JSON.stringify(finalJson, null, 2)
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

// Converts a tree node structure into a string representation
function treeToString(node, prefix = '', isLast = true, maxDepth = Infinity, currentDepth = 0) {
	// Initialize array to store tree lines
	let output = [];
	// Format the size of current node (file/directory)
	const nodeSize = formatSize(node.size);
	let itemPrefix = isLast ? '└───' : '├───';

	if (node.type === 'dir') {
		// For directories: show name and total size
		// Special case: rename '.' to 'ROOT' for the root directory
		output.push(`(${nodeSize}) ${prefix}${itemPrefix}${node.name === '.' ? 'ROOT' : node.name}`);

		// If we haven't reached maxDepth, process children
		if (currentDepth < maxDepth) {
			// Process each child in the directory
			for (let i = 0; i < node.children.length; i++) {
				const child = node.children[i];
				// Check if there is a next child
				const isLastChild = i === node.children.length - 1;
				// Create indentation for child items
				const childPrefix = prefix + (isLast ? '    ' : '│   ');

				output = output.concat(treeToString(child, childPrefix, isLastChild, maxDepth, currentDepth + 1));
			}
		}
	} else {
		// For files: show filename and size
		output.push(`(${nodeSize}) ${prefix}${itemPrefix}${node.name}`);
	}

	return output;
}



// Helper functions for snapshot
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

// Function to display history statistics
async function historyStats() {
	console.log(chalk.blue('History statistics:'));
	// Add your logic to display history statistics here
	// For example, you can read the folder_history directory and count the number of snapshots
	const snapshotFiles = fs.readdirSync('folder_history/snapshots').filter(file => file.endsWith('.txt'));
	console.log(chalk.white(`Total # of snapshots: ${snapshotFiles.length}`));
	// Read the current tree.json

	let currentJSON;
	let currentTree;
	let currentInfo;

	try {
		currentJSON = JSON.parse(
			fs.readFileSync('folder_history/tree.json', 'utf8')
		);

		currentTree = currentJSON.tree;
		currentInfo = currentJSON.info;

		console.log('Directory size:', formatSize(currentTree.size));

		// sort this layer 1 of the tree by size
		currentTree.children.sort((a, b) => b.size - a.size);

		console.log(chalk.blueBright('Current directory tree sorted:'));
		console.log(treeToString(currentTree, '', true, 1).join('\n'));

	} catch (error) {
		console.log(chalk.yellow('No current tree data found'));
	}

}
