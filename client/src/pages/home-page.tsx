="nav-capture"
          >
            <Plus className={`w-[22px] h-[22px] transition-all duration-300 ${
              captureMenuOpen ? "rotate-45 text-white/70" : "text-white"
            }`} />
          </button>
        </nav>
      )}

      {/* Capture Menu Overlay */}
      <AnimatePresence>
        {captureMenuOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCaptureMenuOpen(false)}
            />
            <motion.div
              className="fixed bottom-20 right-4 z-[25] w-[220px]"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 dark:border-slate-700/50 overflow-hidden">

                {/* 1. Voice Debrief — primary */}
                <button
                  onClick={() => handleCaptureOption("debrief")}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  data-testid="capture-debrief"
                >
                  <div className="w-10 h-10 rounded-full bg-violet-500/15 flex items-center justify-center text-violet-600 dark:text-violet-400">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">Voice Debrief</p>
                    <p className="text-[11px] text-muted-foreground">After a meeting</p>
                  </div>
                </button>

                <div className="border-t border-border/50" />

                {/* 2. Scan Card */}
                <button
                  onClick={() => handleCaptureOption("scan")}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  data-testid="capture-scan"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">Scan Card</p>
                    <p className="text-[11px] text-muted-foreground">Photo of a business card</p>
                  </div>
                </button>

                <div className="border-t border-border/50" />

                {/* 3. Paste Signature */}
                <button
                  onClick={() => handleCaptureOption("paste")}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  data-testid="capture-paste"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">Paste Signature</p>
                    <p className="text-[11px] text-muted-foreground">Extract from email text</p>
                  </div>
                </button>

                <div className="border-t border-border/50" />

                {/* 4. Share My QR */}
                <button
                  onClick={() => handleCaptureOption("qr")}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  data-testid="capture-qr"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">Share My QR</p>
                    <p className="text-[11px] text-muted-foreground">Let them scan your card</p>
                  </div>
                </button>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Capture Bottom Sheet */}
      <AnimatePresence>
        {captureSheetMode && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCaptureSheetClose}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-background rounded-t-3xl z-50 max-h-[92vh] overflow-y-auto"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
              <ScanTab
                onBackToContacts={handleCaptureSheetClose}
                onDeleteContact={handleDeleteContact}
                onContactSaved={(contact) => {
                  handleCaptureSheetClose();
                  if (contact) handleSelectContact(contact);
                  refreshContacts();
                }}
                onContactUpdated={handleContactUpdated}
                onViewInOrgMap={(companyId) => {
                  handleCaptureSheetClose();
                  handleSelectCompany(companyId, 'orgmap');
                }}
                onShowingContactChange={() => {}}
                initialMode={captureSheetMode}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Voice Debrief Bottom Sheet */}
      <AnimatePresence>
        {debriefSheetOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={debriefPhase === "record" ? handleDebriefCancel : undefined}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-background rounded-t-3xl z-50 max-h-[92vh] overflow-y-auto"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {debriefPhase === "record" && (
                <VoiceDebriefRecorder
                  onTranscriptReady={handleDebriefTranscriptReady}
                  onCancel={handleDebriefCancel}
                />
              )}
              {debriefPhase === "review" && (
                <VoiceDebriefReviewSheet
                  transcript={debriefTranscript}
                  onComplete={handleDebriefComplete}
                  onCancel={handleDebriefCancel}
                  preSelectedContactId={debriefPreSelectedContactId}
                />
              )}
              {debriefPhase === "success" && (
                <div className="px-5 pt-4 pb-8">
                  <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-5" />
                  <div className="flex flex-col items-center gap-4 py-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div className="text-center">
                      <h2 className="text-lg font-bold text-foreground">Debrief Saved</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Notes, tasks, and reminders have been added to the contact.
                      </p>
                    </div>
                    <button
                      onClick={handleDebriefClose}
                      className="mt-2 text-sm font-semibold px-6 py-2.5 rounded-xl bg-primary text-primary-foreground"
                      data-testid="button-view-contact-debrief"
                    >
                      View Contact
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* QR Modal — capture menu, lands on QR tab */}
      <MyQRModal
        trigger={<span className="hidden" />}
        open={qrModalOpen}
        onOpenChange={setQrModalOpen}
      />

      {/* Profile Modal — profile menu, lands on edit tab */}
      <MyQRModal
        trigger={<span className="hidden" />}
        open={profileSheetOpen}
        onOpenChange={setProfileSheetOpen}
        initialTab="edit"
      />

      {/* Create Contact Drawer */}
      <CreateContactDrawer
        open={showCreateContactDrawer}
        onOpenChange={setShowCreateContactDrawer}
        onContactCreated={refreshContacts}
      />

      {/* HubSpot Integration */}
      <HubSpotProfile
        open={showHubSpotProfile}
        onOpenChange={setShowHubSpotProfile}
      />

      {/* Salesforce Integration */}
      <SalesforceProfile
        open={showSalesforceProfile}
        onOpenChange={setShowSalesforceProfile}
      />
    </div>
  );
}
