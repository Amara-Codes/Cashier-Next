// This file will contain the CustomDiscountModal component
import React, { useState } from 'react';
import { Button } from "@/components/ui/button"; // Assuming you have a Button component
import { Input } from "@/components/ui/input"; // Assuming you have an Input component
import { Label } from "@/components/ui/label"; // Assuming you have a Label component
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Assuming you have RadioGroup for selection

interface CustomDiscountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApplyDiscount: (value: number, type: 'dollar' | 'percentage') => void;
    currentCustomDiscount: { value: number; type: 'dollar' | 'percentage' };
}

export const CustomDiscountModal: React.FC<CustomDiscountModalProps> = ({
    isOpen,
    onClose,
    onApplyDiscount,
    currentCustomDiscount,
}) => {
    const [discountValue, setDiscountValue] = useState<string>(currentCustomDiscount.value.toString());
    const [discountType, setDiscountType] = useState<'dollar' | 'percentage'>(currentCustomDiscount.type);

    if (!isOpen) return null;

    const handleApply = () => {
        const value = parseFloat(discountValue);
        if (!isNaN(value) && value >= 0) {
            onApplyDiscount(value, discountType);
            onClose();
        } else {
            alert('Please enter a valid non-negative number for the discount.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm mx-4">
                <h2 className="text-2xl font-bold mb-8 text-primary">Apply Custom Discount</h2>

                <div className="mb-4">
                    <Label htmlFor="discountValue" className="block text-foreground text-bold text-lg mb-4">Discount Amount</Label>
                    <Input
                        id="discountValue"
                        type="number"
                        step="0.01"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        placeholder="e.g., 10 or 5.50"
                        className="w-full text-foreground bg-input border-input"
                    />
                </div>

                <div className="mb-6">
                    <Label className="block text-foreground text-bold text-lg mb-4">Discount Type</Label>
                    <RadioGroup
                        value={discountType}
                        onValueChange={(value: 'dollar' | 'percentage') => setDiscountType(value)}
                        className="flex space-x-4"
                    >
                        <div className="flex items-center space-x-4 ps-2">
                            <RadioGroupItem value="dollar" id="type-dollar" />
                            <Label htmlFor="type-dollar">$ (Dollar)</Label>
                        </div>
                        <div className="flex items-center space-x-4">
                            <RadioGroupItem value="percentage" id="type-percentage" />
                            <Label htmlFor="type-percentage">% (Percentage)</Label>
                        </div>
                    </RadioGroup>
                </div>

                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleApply}>Apply Discount</Button>
                </div>
            </div>
        </div>
    );
};