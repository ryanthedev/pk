import * as vscode from 'vscode';


export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('tabz.tabs', () => {
        showQuickPick();
    });

    context.subscriptions.push(disposable);
}

interface TabQuickPickItem extends vscode.QuickPickItem {
    tabGroup: vscode.TabGroup;
    tab: vscode.Tab;
    alwaysShow: boolean;
}

async function showQuickPick() {
    const quickPick = vscode.window.createQuickPick<TabQuickPickItem>();
    quickPick.placeholder = 'Search open tabs...';

	// Get all open tabs across all tab groups
	const allTabs: TabQuickPickItem[] = [];

	// Populate tabs with enhanced information
	for (const tabGroup of vscode.window.tabGroups.all) {
		for (const tab of tabGroup.tabs) {
            allTabs.push({
                label: tab.label,
                description: tab.input instanceof vscode.TabInputText ? tab.input.uri.fsPath : '',
                detail: '', 
                // iconPath: new vscode.ThemeIcon('cs'),
                // buttons: [
                //     {
                //         iconPath: new vscode.ThemeIcon('testing-queued-icon'),
                //         tooltip: 'Tab Icon'
                //     }
                // ],
                tabGroup,
                tab,
                alwaysShow: false
            });
        }
    }

    // Dynamically import Fuse.js
    const FuseModule = await import('fuse.js');
    const Fuse = FuseModule.default;

    // Configure Fuse.js options
	const fuseOptions = {
		keys: ['label', 'description'],
		includeScore: true,
		threshold: 0.2,
		distance: 50,
		findAllMatches: true,
		ignoreLocation: true,   // Ignore where in the string the match occurs
		useExtendedSearch: true // Enable extended search patterns
	};

    const fuse = new Fuse(allTabs, fuseOptions);

    // Update items based on search
    quickPick.onDidChangeValue(value => {
        if (!value) {
            // Reset all items to alwaysShow: false when there's no search
            allTabs.forEach(item => item.alwaysShow = false);
            quickPick.items = allTabs;
            return;
        }

        try {
            const searchResults = fuse.search(value);
            quickPick.show();
            
            // Reset all items to alwaysShow: false
            allTabs.forEach(item => item.alwaysShow = false);

            // Sort results by score (lower score = better match)
            searchResults.sort((a, b) => (a.score || 0) - (b.score || 0));
            
            // Set alwaysShow: true for items in search results
            searchResults.forEach(result => {
                result.item.alwaysShow = true;
            });

            const sortedItems = [
                ...searchResults.map(result => result.item),
                ...allTabs.filter(item => !item.alwaysShow)
            ];

            quickPick.items = sortedItems;

            // Set the best match as the active item
            if (searchResults.length > 0) {
                quickPick.activeItems = [searchResults[0].item];
            }

            // console.log(`first ${searchResults[0].item.label}`);
            // console.log(`last ${searchResults[searchResults.length - 1].item.label}`);
        } catch (err) {
            console.log(err);
        }
    });


    // Handle selection
    quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0];
        if (selected) {
            if (selected.tab.input instanceof vscode.TabInputText) {
                await vscode.window.showTextDocument(selected.tab.input.uri, {
                    viewColumn: selected.tabGroup.viewColumn,
                    preserveFocus: false
                });
            } else if (selected.tab.input instanceof vscode.TabInputNotebook) {
                const notebookDoc = await vscode.workspace.openNotebookDocument(selected.tab.input.uri);
                await vscode.window.showNotebookDocument(notebookDoc, {
                    viewColumn: selected.tabGroup.viewColumn
                });
            } else if (selected.tab.input instanceof vscode.TabInputWebview) {
                vscode.window.showInformationMessage("Focusing webview tabs is not supported yet.");
            } else if (selected.tab.input instanceof vscode.TabInputCustom) {
                await vscode.window.showTextDocument(selected.tab.input.uri, {
                    viewColumn: selected.tabGroup.viewColumn,
                    preserveFocus: false
                });
            }
        }
        quickPick.hide();
    });

    // Initial items
    quickPick.items = allTabs;
    quickPick.show();
}

export function deactivate() {}