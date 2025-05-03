// scanner-worker.js (Worker Thread)
import { workerData, parentPort } from 'worker_threads';
import fs from 'fs';

parentPort.postMessage({ status: 'start', dir: workerData.dir });

try {
	const tree = buildTreeJson(workerData.dir);
	parentPort.postMessage({ status: 'complete', tree });
} catch (error) {
	parentPort.postMessage({ status: 'error', error: error.message });
}

// Helper functions for snapshot
function buildTreeJson(dir) {
	let tree = { name: dir.split('/').pop(), type: 'dir', size: 0, children: [] };
	let items;

	try {
		items = fs.readdirSync(dir);
	} catch (error) {
		parentPort.postMessage({ status: 'error', error: `Could not read directory ${dir}: ${error.message}` });

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
			parentPort.postMessage({ status: 'warning', message: `Could not access ${path}: ${error.message}` });
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

	// Directory done
	const currentItem = dir.split('/').pop();
	const percent = Math.floor(Math.random() * 100); // This is a placeholder. For real progress, you'd need to track total files/directories
	parentPort.postMessage({ status: 'progress', currentItem, percent });

	return tree;
}

export default buildTreeJson;