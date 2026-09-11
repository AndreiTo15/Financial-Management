// Finora — delegated click events
(function bindFinoraActions(){
  const handlers={
    'auth-mode':el=>Finora.auth.mode(el.dataset.mode),
    'email-confirm-ok':()=>{Finora.ui.closeModal('email-modal');Finora.auth.mode('login')},

    'open-notifications':()=>Finora.notifications.open(),
    'mark-notifications-read':()=>Finora.notifications.markRead(),
    'toggle-privacy':()=>Finora.ui.togglePrivacy(),
    'toggle-theme':()=>Finora.ui.toggleTheme(),

    'open-modal':el=>Finora.ui.openModal(el.dataset.target),
    'close-modal':el=>Finora.ui.closeModal(el.dataset.target),
    'navigate':el=>Finora.ui.goPage(el.dataset.page),

    'quick-add':()=>Finora.ui.openQuickAdd(),
    'quick-add-type':el=>Finora.ui.quickAddType(el.dataset.type),

    'new-transaction':el=>Finora.transactions.open(el.dataset.type),
    'edit-transaction':el=>Finora.transactions.edit(el.dataset.id),
    'delete-transaction':el=>Finora.transactions.remove(el.dataset.id),

    'quick-filter':el=>Finora.ui.setQuickFilter(el.dataset.filter),
    'toggle-advanced-filters':()=>Finora.ui.toggleAdvancedFilters(),

    'open-budget':()=>Finora.budgets.open(),
    'edit-budget':el=>Finora.budgets.edit(el.dataset.id),
    'delete-budget':el=>Finora.budgets.remove(el.dataset.id),

    'open-subscription':()=>Finora.subscriptions.open(),
    'edit-subscription':el=>Finora.subscriptions.edit(el.dataset.id),
    'delete-subscription':el=>Finora.subscriptions.remove(el.dataset.id),
    'toggle-subscription':el=>Finora.subscriptions.toggle(el.dataset.id,el.dataset.active==='true'),

    'open-category':()=>Finora.categories.open(),
    'edit-category':el=>Finora.categories.edit(el.dataset.id),

    'open-goal':()=>Finora.goals.open(),
    'edit-goal':el=>Finora.goals.edit(el.dataset.id),
    'delete-goal':el=>Finora.goals.remove(el.dataset.id),
    'contribute-goal':el=>Finora.goals.contribute(el.dataset.id),

    'open-asset':()=>Finora.wealth.openAsset(),
    'edit-asset':el=>Finora.wealth.editAsset(el.dataset.id),
    'delete-asset':el=>Finora.wealth.removeAsset(el.dataset.id),

    'run-ai-analysis':()=>Finora.analysis.runAI(),
    'toggle-analysis-details':()=>Finora.ui.toggleAnalysisDetails(),
    'toggle-ai-history':()=>Finora.analysis.toggleHistory(),
    'open-ai-history-report':el=>Finora.analysis.openHistoryReport(el.dataset.id),

    'finish-onboarding':()=>Finora.ui.finishOnboarding(),
    'next-onboarding':()=>Finora.ui.nextOnboarding(),

    'save-setup':()=>Finora.ui.saveSetupWizard(),
    'setup-from-settings':()=>{Finora.ui.closeModal('settings-modal');Finora.ui.openSetupWizard()},
    'onboarding-from-settings':()=>{Finora.ui.closeModal('settings-modal');Finora.ui.showOnboarding(true)},

    'open-legal':el=>Finora.notifications.openLegal(el.dataset.document),

    'save-settings':()=>Finora.settings.save(),
    'change-password':()=>Finora.auth.mode('reset-direct'),
    'request-account-deletion':()=>Finora.auth.requestAccountDeletion(),
    'delete-account':()=>Finora.auth.deleteAccount(),
    'logout':()=>Finora.auth.logout(),

    'export-csv':()=>Finora.data.exportCSV(),
    'export-backup':()=>Finora.data.exportBackup(),
    'copy-diagnostics':()=>Finora.ui.copyDiagnostics()
  };

  document.addEventListener('click',event=>{
    const el=event.target.closest('[data-action]');
    if(!el)return;
    const handler=handlers[el.dataset.action];
    if(!handler){console.warn('[Finora] Unknown data-action:',el.dataset.action);return}
    event.preventDefault();
    handler(el,event);
  });
})();
