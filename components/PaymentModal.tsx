// This file will contain the PaymentModal component
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from '@/components/ui/label'; // Assuming you have a Button component
// Assuming you have an Input componentimport { Label } from "@/components/ui/label"; // Assuming you have a Label component
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Assuming you have RadioGroup for selection

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPaid: (value: number | string, type: 'QR' | 'cash') => void;
    totalInDollars?: number | string; // Optional, if you need to display total in dollars
    totalInRiels?: number | string; // Optional, if you need to display total in Rie
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
    isOpen,
    onClose,
    onPaid,
    totalInDollars,
    totalInRiels,
}) => {

    const [paymentMethod, setPaymentMethod] = useState<'QR' | 'cash'>('QR');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm mx-4">
                <h2 className="text-2xl font-bold mb-8 text-primary text-center">Payment</h2>

                <div className="mb-4 rounded-lg border-primary border-2 p-4 bg-card">
                    <Label className="block text-foreground text-bold text-lg mb-4">Total Amount</Label>
                    <div className="flex items-center space-x-2 justify-between">
                        <span className="text-lg font-semibold text-primary">
                            {totalInDollars ? `$${totalInDollars}` : 'N/A'}
                        </span>
                        <span className="text-lg font-semibold text-primary">
                            {totalInRiels ? `៛${totalInRiels}` : 'N/A'}
                        </span>
                    </div>
                </div>

                <div className="mb-6 rounded-lg border-primary border-2 p-4 bg-card">
                    <Label className="block text-foreground text-bold text-lg mb-4">Payment method</Label>
                    <RadioGroup
                        value={paymentMethod}
                        onValueChange={(value: 'QR' | 'cash') => setPaymentMethod(value)}
                        className="flex space-x-4 mb-4">

                        <div className="flex items-center space-x-4 ps-2">
                            <RadioGroupItem value="QR" id="type-QR" />
                            <Label className="underline" htmlFor="type-QR">QR</Label>
                        </div>
                        <div className="flex items-center space-x-4">
                            <RadioGroupItem value="cash" id="type-cash" />
                            <Label className="underline" htmlFor="type-cash">Cash</Label>
                        </div>
                    </RadioGroup>


                </div>

                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={() => {
                            onPaid(totalInDollars ?? 0, paymentMethod); // Assuming you want to pass 0 as the value for now
                            onClose();
                        }}
                    >
                        Pay
                    </Button>
                </div>
            </div>
        </div>
    );
};