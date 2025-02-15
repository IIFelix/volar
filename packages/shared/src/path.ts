import { URI } from 'vscode-uri';
import * as upath from 'upath';
import type { DocumentUri } from 'vscode-languageserver-textdocument';

export function getPathOfUri(uri: DocumentUri) {
	return upath.toUnix(URI.parse(uri).fsPath);
}

export function normalizeFileName(fsPath: string) {
	return upath.toUnix(URI.file(fsPath).fsPath);
}

export function normalizeUri(uri: string) {
	return URI.parse(uri).toString();
}

export function getUriByPath(rootUri: URI, path: string) {
	return URI.file(path).with({
		scheme: rootUri.scheme,
		authority: rootUri.authority,
	}).toString();
}

export function isFileInDir(fileName: string, dir: string) {
	const relative = upath.relative(dir, fileName);
	return !!relative && !relative.startsWith('..') && !upath.isAbsolute(relative);
}
