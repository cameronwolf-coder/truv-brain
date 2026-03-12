// ==UserScript==
// @name         Knock Dashboard Power Tools
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Sort by date and name, quick delete, and edit features for Knock workflows and audiences.
// @author       Cameron
// @match        https://dashboard.knock.app/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let lastUrl = location.href;
    let dateSortAsc = false;
    let nameSortAsc = true;

    // Observe changes inside the main application for SPA navigation
    const observer = new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
        }

        const path = window.location.pathname;
        if (path.includes('/workflows') || path.includes('/audiences')) {
            // Slight delay to allow React/UI to render
            setTimeout(() => {
                injectSortButtons();
                injectQuickActions();
            }, 500);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Initial run
    setTimeout(() => {
        injectSortButtons();
        injectQuickActions();
    }, 1000);


    function injectSortButtons() {
        // We only want to inject buttons into the main content area, not the sidebar
        // Knock typically uses a <main> tag or heavy div structure for the content.
        // Let's restrict our search for headers to the right-side content area.
        const mainContentArea = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
        const allElements = Array.from(mainContentArea.querySelectorAll('*'));

        // Date Header
        if (!document.getElementById('tm-sort-date-btn')) {
            const dateHeader = allElements.find(
                el => el.textContent.trim() === 'Updated at' &&
                    ['TH', 'DIV', 'SPAN'].includes(el.tagName) &&
                    el.children.length === 0
            );

            if (dateHeader) {
                const sortBtn = document.createElement('button');
                sortBtn.id = 'tm-sort-date-btn';
                sortBtn.innerText = ' ↕️';
                sortBtn.style.cssText = 'background:none; border:none; cursor:pointer; font-size:14px; margin-left:8px; vertical-align: middle; z-index: 100; position: relative;';
                sortBtn.title = 'Sort by Date';
                sortBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    sortRows('date', sortBtn);
                };

                dateHeader.parentNode.appendChild(sortBtn);
            }
        }

        // Name Header
        if (!document.getElementById('tm-sort-name-btn')) {
            const nameHeader = allElements.find(
                el => (el.textContent.trim() === 'Name / Key' || el.textContent.trim() === 'Name') &&
                    ['TH', 'DIV', 'SPAN'].includes(el.tagName) &&
                    el.children.length === 0
            );

            if (nameHeader) {
                const sortBtn = document.createElement('button');
                sortBtn.id = 'tm-sort-name-btn';
                sortBtn.innerText = ' ↕️';
                sortBtn.style.cssText = 'background:none; border:none; cursor:pointer; font-size:14px; margin-left:8px; vertical-align: middle; z-index: 100; position: relative;';
                sortBtn.title = 'Sort by Name';
                sortBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    sortRows('name', sortBtn);
                };

                nameHeader.parentNode.appendChild(sortBtn);
            }
        }
    }

    function sortRows(type, btnElement) {
        console.log(`[Knock Tools] Sorting by ${type}`);

        // Look inside the main content area to avoid grabbing sidebar items
        const mainContentArea = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;

        // Find the action buttons to reliably identify rows ONLY in the main content area
        const dotMenus = Array.from(mainContentArea.querySelectorAll('button')).filter(btn => {
            return btn.innerHTML.includes('circle') || btn.getAttribute('aria-label') === 'Actions';
        });

        if (dotMenus.length === 0) {
            console.warn("[Knock Tools] No action menus found in main content area.");
            return;
        }

        // Determine list container and rows
        let rowElements = [];
        let listContainer = null;

        const dateRegex = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/;

        // Find the container based on the action menus in the main content area
        for (let menu of dotMenus) {
            let parent = menu.parentElement;
            while (parent && parent !== mainContentArea && parent !== document.body) {
                // Check how many of its direct children contain an action button or are an action button
                const childrenWithMenus = Array.from(parent.children).filter(child => {
                    return child === menu || child.contains(menu) || Array.from(child.querySelectorAll('button')).some(b => b.innerHTML.includes('circle') || b.getAttribute('aria-label') === 'Actions');
                });

                // If it contains a few menu buttons, it's our list container
                if (childrenWithMenus.length >= 2) {
                    listContainer = parent;
                    rowElements = childrenWithMenus;
                    break;
                }
                parent = parent.parentElement;
            }
            if (listContainer) break;
        }

        if (!listContainer || rowElements.length < 2) {
            console.warn("[Knock Tools] Could not definitively find list structure.", listContainer, rowElements);
            alert("Could not identify the list structure to sort.");
            return;
        }

        console.log(`[Knock Tools] Found list container with ${rowElements.length} items`);

        // Map and sort the target data
        const rowsWithData = rowElements.map(row => {
            let sortValue = 0;

            if (type === 'date') {
                const match = row.textContent.match(dateRegex);
                const dateStr = match ? match[0] : null;
                sortValue = dateStr ? new Date(dateStr).getTime() : 0;
            } else if (type === 'name') {
                // We specifically want the first meaningful text string.
                const possibleNameElems = Array.from(row.querySelectorAll('a, strong, span'));
                const firstMeaningfulText = possibleNameElems.find(el => el.textContent.trim().length > 2);
                sortValue = firstMeaningfulText ? firstMeaningfulText.textContent.trim().toLowerCase() : row.textContent.trim().toLowerCase();
            }

            return { row, sortValue };
        });

        rowsWithData.sort((a, b) => {
            if (type === 'date') {
                return dateSortAsc ? a.sortValue - b.sortValue : b.sortValue - a.sortValue;
            } else {
                if (a.sortValue < b.sortValue) return nameSortAsc ? -1 : 1;
                if (a.sortValue > b.sortValue) return nameSortAsc ? 1 : -1;
                return 0;
            }
        });

        if (type === 'date') {
            dateSortAsc = !dateSortAsc;
            if (btnElement) { btnElement.innerText = dateSortAsc ? ' ⬆️' : ' ⬇️'; }
            const otherBtn = document.getElementById('tm-sort-name-btn');
            if (otherBtn) { otherBtn.innerText = ' ↕️'; }
        } else {
            nameSortAsc = !nameSortAsc;
            if (btnElement) { btnElement.innerText = nameSortAsc ? ' ⬆️' : ' ⬇️'; }
            const otherBtn = document.getElementById('tm-sort-date-btn');
            if (otherBtn) { otherBtn.innerText = ' ↕️'; }
        }

        // We MUST force Flexbox on the container if we are going to use order
        listContainer.style.display = 'flex';
        listContainer.style.flexDirection = 'column';

        // Apply sorting visually with `order`
        rowsWithData.forEach((data, index) => {
            data.row.style.order = index + 1;
        });

        // Ensure non-data rows stay at top
        Array.from(listContainer.children).forEach(child => {
            if (!rowElements.includes(child)) {
                child.style.order = 0;
            }
        });

        console.log(`[Knock Tools] Sorted elements applied via CSS order.`);
    }

    function injectQuickActions() {
        // Restrict quick action injection to the main content area as well
        const mainContentArea = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;

        // Look for the action menus (the 3 horizontal dots icon inside a button)
        const dotMenus = mainContentArea.querySelectorAll('button');
        const validMenus = Array.from(dotMenus).filter(btn => {
            return (btn.innerHTML.includes('circle') || btn.getAttribute('aria-label') === 'Actions') && !btn.closest('.tm-actions-injected');
        });

        validMenus.forEach(btn => {
            const container = btn.parentElement;

            // Avoid double injecting
            if (container.classList.contains('tm-actions-injected')) return;
            container.classList.add('tm-actions-injected');
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.gap = '8px';

            // Find the row
            let row = btn.closest('tr') || btn.closest('[role="row"]');
            if (!row) {
                let parent = container;
                while (parent && parent !== mainContentArea && parent !== document.body) {
                    if (parent.parentElement && parent.parentElement.children.length > 2) {
                        row = parent;
                        break;
                    }
                    parent = parent.parentElement;
                }
            }

            // Edit Button
            const editBtn = document.createElement('button');
            editBtn.innerHTML = '✏️';
            editBtn.title = 'Quick Edit';
            editBtn.style.cssText = 'background:none; border:none; cursor:pointer; font-size:16px; padding:4px; border-radius:4px; opacity: 0.6; transition: opacity 0.2s;';
            editBtn.onmouseenter = () => { editBtn.style.opacity = '1'; };
            editBtn.onmouseleave = () => { editBtn.style.opacity = '0.6'; };
            editBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                const link = row ? row.querySelector('a') : null;
                if (link) {
                    window.location.href = link.href;
                } else {
                    btn.click();
                    setTimeout(() => {
                        const items = Array.from(document.querySelectorAll('[role="menuitem"], .menu-item, [role="button"]'));
                        const editItem = items.find(i => i.textContent.includes('Edit') || i.textContent.includes('Settings'));
                        if (editItem) {
                            editItem.click();
                        } else {
                            btn.click();
                        }
                    }, 50);
                }
            };

            // Delete / Archive Button
            const delBtn = document.createElement('button');
            delBtn.innerHTML = '🗑️';
            delBtn.title = 'Quick Archive / Delete';
            delBtn.style.cssText = 'background:none; border:none; cursor:pointer; font-size:16px; padding:4px; border-radius:4px; opacity: 0.6; transition: opacity 0.2s;';
            delBtn.onmouseenter = () => { delBtn.style.opacity = '1'; };
            delBtn.onmouseleave = () => { delBtn.style.opacity = '0.6'; };
            delBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (confirm('Are you sure you want to delete/archive this?')) {
                    btn.click();
                    setTimeout(() => {
                        const items = Array.from(document.querySelectorAll('[role="menuitem"], .menu-item, [role="button"]'));
                        const delItem = items.find(i => i.textContent.includes('Delete') || i.textContent.includes('Archive') || i.textContent.includes('Remove'));
                        if (delItem) {
                            delItem.click();
                        } else {
                            btn.click();
                            alert("Delete/Archive option not found in menu.");
                        }
                    }, 50);
                }
            };

            container.insertBefore(delBtn, btn);
            container.insertBefore(editBtn, delBtn);
        });
    }

})();
