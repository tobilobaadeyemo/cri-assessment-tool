interface EmailOptions {
    to: string;
    type: 'welcome' | 'invite' | 'reminder' | 'report_ready' | 'payment_confirmation' | 'abandoned_cart';
    assessmentId?: string;
    organizationId?: string;
    data?: Record<string, any>;
}
export declare function sendEmail(options: EmailOptions): Promise<void>;
export declare function processReminderQueue(): Promise<void>;
export {};
//# sourceMappingURL=emailService.d.ts.map