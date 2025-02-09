import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { GetConfiguration } from '..';
import { getUserPreferences } from '../configs/getUserPreferences';

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	getConfiguration: GetConfiguration,
	ts: typeof import('typescript/lib/tsserverlibrary'),
) {
	return async (uri: string, range: vscode.Range) => {

		const document = getTextDocument(uri);
		if (!document) return;

		const preferences = await getUserPreferences(getConfiguration, document.uri);
		const fileName = shared.getPathOfUri(document.uri);
		const start = document.offsetAt(range.start);
		const end = document.offsetAt(range.end);
		const inlayHints = 'provideInlayHints' in languageService ? languageService.provideInlayHints(fileName, { start, length: end - start }, preferences) : [];

		return inlayHints.map(inlayHint => {
			const result = vscode.InlayHint.create(
				document.positionAt(inlayHint.position),
				inlayHint.text,
				inlayHint.kind === ts.InlayHintKind.Type ? vscode.InlayHintKind.Type
					: inlayHint.kind === ts.InlayHintKind.Parameter ? vscode.InlayHintKind.Parameter
						: undefined,
			);
			result.paddingLeft = inlayHint.whitespaceBefore;
			result.paddingRight = inlayHint.whitespaceAfter;
			return result;
		});
	};
}
