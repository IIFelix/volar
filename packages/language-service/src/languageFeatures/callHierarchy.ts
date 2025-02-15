import * as shared from '@volar/shared';
import * as upath from 'upath';
import type * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as dedupe from '../utils/dedupe';
import { languageFeatureWorker } from '../utils/featureWorkers';

export interface PluginCallHierarchyData {
	uri: string,
	originalItem: vscode.CallHierarchyItem,
	pluginId: number,
	sourceMap: {
		embeddedDocumentUri: string;
	} | undefined,
}

export function register(context: LanguageServiceRuntimeContext) {

	return {

		doPrepare(uri: string, position: vscode.Position) {

			return languageFeatureWorker(
				context,
				uri,
				position,
				function* (position, sourceMap) {
					for (const [mappedRange] of sourceMap.getMappedRanges(
						position,
						position,
						data => !!data.references,
					)) {
						yield mappedRange.start;
					}
				},
				async (plugin, document, position, sourceMap) => {

					const items = await plugin.callHierarchy?.prepare(document, position);

					return items?.map<vscode.CallHierarchyItem>(item => {
						return {
							...item,
							data: {
								uri,
								originalItem: item,
								pluginId: context.plugins.indexOf(plugin),
								sourceMap: sourceMap ? {
									embeddedDocumentUri: sourceMap.mappedDocument.uri,
								} : undefined,
							} satisfies PluginCallHierarchyData,
						};
					});
				},
				(data, sourceMap) => !sourceMap ? data : data
					.map(item => transformCallHierarchyItem(item, [])?.[0])
					.filter(shared.notEmpty),
				arr => dedupe.withLocations(arr.flat()),
			);
		},

		async getIncomingCalls(item: vscode.CallHierarchyItem) {

			const data: PluginCallHierarchyData | undefined = item.data;
			let incomingItems: vscode.CallHierarchyIncomingCall[] = [];

			if (data) {

				const plugin = context.plugins[data.pluginId];

				if (!plugin)
					return incomingItems;

				if (!plugin.callHierarchy)
					return incomingItems;

				const originalItem = data.originalItem;

				if (data.sourceMap) {

					const sourceMap = context.documents.sourceMapFromEmbeddedDocumentUri(data.sourceMap.embeddedDocumentUri);

					if (sourceMap) {

						const _calls = await plugin.callHierarchy.onIncomingCalls(originalItem);

						for (const _call of _calls) {

							const calls = transformCallHierarchyItem(_call.from, _call.fromRanges);

							if (!calls)
								continue;

							incomingItems.push({
								from: calls[0],
								fromRanges: calls[1],
							});
						}
					}
				}
				else {

					const _calls = await plugin.callHierarchy.onIncomingCalls(item);

					for (const _call of _calls) {

						const calls = transformCallHierarchyItem(_call.from, _call.fromRanges);

						if (!calls)
							continue;

						incomingItems.push({
							from: calls[0],
							fromRanges: calls[1],
						});
					}
				}
			}

			return dedupe.withCallHierarchyIncomingCalls(incomingItems);
		},

		async getOutgoingCalls(item: vscode.CallHierarchyItem) {

			const data: PluginCallHierarchyData | undefined = item.data;
			let items: vscode.CallHierarchyOutgoingCall[] = [];

			if (data) {

				const plugin = context.plugins[data.pluginId];

				if (!plugin)
					return items;

				if (!plugin.callHierarchy)
					return items;

				const originalItem = data.originalItem;

				if (data.sourceMap) {

					const sourceMap = context.documents.sourceMapFromEmbeddedDocumentUri(data.sourceMap.embeddedDocumentUri);

					if (sourceMap) {

						const _calls = await plugin.callHierarchy.onOutgoingCalls(originalItem);

						for (const call of _calls) {

							const calls = transformCallHierarchyItem(call.to, call.fromRanges);

							if (!calls)
								continue;

							items.push({
								to: calls[0],
								fromRanges: calls[1],
							});
						}
					}
				}
				else {

					const _calls = await plugin.callHierarchy.onOutgoingCalls(item);

					for (const call of _calls) {

						const calls = transformCallHierarchyItem(call.to, call.fromRanges);

						if (!calls)
							continue;

						items.push({
							to: calls[0],
							fromRanges: calls[1],
						});
					}
				}
			}

			return dedupe.withCallHierarchyOutgoingCalls(items);
		},
	};

	function transformCallHierarchyItem(tsItem: vscode.CallHierarchyItem, tsRanges: vscode.Range[]): [vscode.CallHierarchyItem, vscode.Range[]] | undefined {

		const sourceMap = context.documents.sourceMapFromEmbeddedDocumentUri(tsItem.uri);
		if (!sourceMap)
			return [tsItem, tsRanges]; // not virtual file

		let vueRange: vscode.Range | undefined = sourceMap.getSourceRange(tsItem.range.start, tsItem.range.end)?.[0];
		if (!vueRange) {
			// TODO: <script> range
			vueRange = {
				start: sourceMap.sourceDocument.positionAt(0),
				end: sourceMap.sourceDocument.positionAt(sourceMap.sourceDocument.getText().length),
			};
		}

		const vueSelectionRange = sourceMap.getSourceRange(tsItem.selectionRange.start, tsItem.selectionRange.end)?.[0];
		if (!vueSelectionRange)
			return;

		const vueRanges = tsRanges.map(tsRange => sourceMap.getSourceRange(tsRange.start, tsRange.end)?.[0]).filter(shared.notEmpty);
		const vueItem: vscode.CallHierarchyItem = {
			...tsItem,
			name: tsItem.name === upath.basename(shared.getPathOfUri(sourceMap.mappedDocument.uri)) ? upath.basename(shared.getPathOfUri(sourceMap.sourceDocument.uri)) : tsItem.name,
			uri: sourceMap.sourceDocument.uri,
			range: vueRange,
			selectionRange: vueSelectionRange,
		};

		return [vueItem, vueRanges];
	}
}
