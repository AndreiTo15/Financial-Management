// Finora — public application namespace
window.Finora = {
  meta: Object.freeze({name:'Finora',version:'1.0.0-beta.5',channel:'beta',refactor:3}),

  pwa: {
    check:()=>checkPWAUpdate(true),
    apply:()=>applyPWAUpdate(),
    dismiss:()=>dismissPWAUpdate()
  },

  state: {
    get user() { return user; },
    get profile() { return profile; },
    get settings() { return settings; },
    get categories() { return categories; },
    get transactions() { return transactions; },
    get subscriptions() { return subscriptions; },
    get budgets() { return budgets; },
    get goals() { return goals; },
    get assets() { return assets; },
    get aiReports() { return aiReports; }
  },

  ui: {
    openModal,closeModal,confirmAction,goPage,openQuickAdd,quickAddType,
    togglePrivacy,toggleTheme,toggleAdvancedFilters,setQuickFilter,
    toggleAnalysisDetails,openSetupWizard,saveSetupWizard,
    showOnboarding,nextOnboarding,finishOnboarding,
    toast,premiumToast,copyDiagnostics,openDiagnostics,renderDiagnostics,clearDiagnostics
  },

  auth: {
    mode:authMode,register,login,forgotPassword,updatePassword,
    requestAccountDeletion,deleteAccount,logout
  },

  transactions: {
    open:openTransactionModal,edit:editTransaction,remove:deleteTransaction,save:saveTransaction
  },
  budgets: {
    open:openBudgetModal,edit:editBudget,remove:deleteBudget,save:saveBudget,addExpense:addBudgetExpense
  },
  subscriptions: {
    open:openSubscriptionModal,edit:editSubscription,remove:deleteSubscription,
    toggle:toggleSubscription,save:saveSubscription
  },
  categories: {
    open:openCategoryModal,edit:openCategoryModalById,save:saveCategory
  },
  goals: {
    open:openGoalModal,edit:editGoal,contribute:contributeGoal,remove:deleteGoal,save:saveGoal
  },
  wealth: {
    openAsset:openAssetModal,editAsset,removeAsset:deleteAsset,saveAsset
  },
  analysis: {
    runAI:runAIFinancialAnalysis,runLocal:runFinancialAnalysis,
    toggleHistory:toggleAIHistory,openHistoryReport:openAIHistoryReport,
    deleteHistoryReport:deleteAIHistoryReport
  },
  notifications: {
    open:openNotifications,markRead:markNotificationsRead,openLegal:openLegalModal
  },
  settings: {save:saveSettings},
  data: {exportCSV,exportBackup,importBackup,importCSV}
};
