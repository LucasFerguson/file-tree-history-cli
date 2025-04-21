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
		snapshot();
		console.log(chalk.green('Snapshot created!'));

	} else if (operation === 'Init History') {
		console.log(chalk.green('History NOT initialized!'));
	}

	// console.log(chalk.yellow('\nAlgorithm:'), algorithm);
	// console.log(chalk.yellow('Operation:'), operation);
	// console.log(chalk.yellow('Text:'), text);

	console.log('');

	await inquirer.prompt({
		type: 'input',
		name: 'continue',
		message: 'Press Enter to continue...'
	});

	await showMainMenu();
}

console.clear();
showMainMenu().catch(error => {
	// debugging stuff
	console.error(chalk.red('Fatal error:'), error);
});

function snapshot() {
	try {
		const timestamp = new Date().toISOString().replace(/[:]/g, '-');
		const header = `Snapshot created at: ${timestamp}\n${'='.repeat(50)}\n\n`;

		// Create folder_history if it doesn't exist
		if (!fs.existsSync('folder_history')) {
			fs.mkdirSync('folder_history');
		}

		function buildTreeJson(dir) {
			let tree = { name: dir.split('/').pop(), type: 'dir', size: 0, children: [] };
			const items = fs.readdirSync(dir);

			items.forEach(item => {
				const path = `${dir}/${item}`;
				const stats = fs.statSync(path);
				// Include folder name but skip contents for specific directories
				if (item === 'node_modules' || item === 'folder_history' || item === '.git') {
					tree.children.push({
						name: item,
						type: 'dir',
						size: 0,
						children: [
							{
								name: "Directory skipped",
								type: 'file',
								size: 0
							}
						]
					});
					return;
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
			});

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
			return `${size.toFixed(1)} ${units[unitIndex]}`;
		}

		function treeToString(node, prefix = '') {
			let output = [];
			const nodeSize = formatSize(node.size);

			if (node.type === 'dir') {
				output.push(`${prefix}${node.name === '.' ? 'ROOT' : node.name} (${nodeSize})`);
				node.children.forEach((child, index) => {
					const isLast = index === node.children.length - 1;
					const newPrefix = prefix + (isLast ? '\\---' : '+---');
					const childPrefix = prefix + (isLast ? '    ' : '|   ');
					output = output.concat(treeToString(child, newPrefix));
				});
			} else {
				output.push(`${prefix}${node.name} (${nodeSize})`);
			}

			return output;
		}

		// Build tree structure
		const treeJson = buildTreeJson('.');
		const treeContent = treeToString(treeJson);

		// Write files in folder_history directory
		fs.writeFileSync(
			`folder_history/tree_snapshot_${timestamp}.txt`,
			header + treeContent.join('\n')
		);

		fs.writeFileSync(
			`folder_history/tree_snapshot_${timestamp}.json`,
			JSON.stringify(treeJson, null, 2)
		);

	} catch (error) {
		console.error(chalk.red('Error creating snapshot:'), error.message);
	}
}