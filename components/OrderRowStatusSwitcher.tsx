import React, { useState } from 'react';
import clsx from 'clsx'; // For conditional class names
// Assuming you have react-icons installed

// Define the possible statuses
type OrderRowStatus = 'pending' | 'served' | 'paid' | 'cancelled';

// Props interface for the component
interface OrderRowStatusSwitchProps {
    orderRowId: string | number;
    initialStatus: OrderRowStatus;
    onStatusChange?: (newStatus: OrderRowStatus) => void; // Optional callback for parent
    showingPaidStatus?: boolean; // New prop: if false, don't show the paid button
}

const OrderRowStatusSwitcher: React.FC<OrderRowStatusSwitchProps> = ({
    orderRowId,
    initialStatus,
    onStatusChange,
    showingPaidStatus = true, // Default to true if not provided
}) => {
    const [currentStatus, setCurrentStatus] = useState<OrderRowStatus>(initialStatus);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Function to determine if a status is selectable
    const isSelectable = (status: OrderRowStatus): boolean => {
        // If the current status is 'cancelled', no further changes are allowed.
        if (currentStatus === 'cancelled') {
            return false;
        }

        // Allow transitioning to 'cancelled' from 'pending' or 'served'
        if (status === 'cancelled') {
            return currentStatus === 'pending' || currentStatus === 'served';
        }

        // Allow transitions along the sequence: pending -> served -> paid
        switch (currentStatus) {
            case 'pending':
                return status === 'served';
            case 'served':
                return status === 'paid';
            case 'paid':
                return false; // 'Paid' is the final state in the sequence
            default:
                return false;
        }
    };

    // Function to handle status change
    const handleStatusChange = async (newStatus: OrderRowStatus) => {
        if (newStatus === currentStatus || !isSelectable(newStatus)) {
            return; // Do nothing if same status or not selectable
        }

        setIsLoading(true);
        setError(null);

        try {
            // Assuming your Strapi API endpoint is /api/order-rows/:id
            const response = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/order-rows/${orderRowId}`, {
                method: 'PUT', // Or PATCH, depending on your Strapi configuration
                headers: {
                    'Content-Type': 'application/json',
                    // Add authorization header if needed, e.g., 'Authorization': `Bearer ${yourAuthToken}`
                },
                body: JSON.stringify({ data: { orderRowStatus: newStatus } }), // Strapi expects 'data' wrapper for updates
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to update status');
            }

            setCurrentStatus(newStatus);
            if (onStatusChange) {
                onStatusChange(newStatus);
            }
        } catch (err: any) {
            console.error('Error updating order row status:', err);
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
            // Reload the page to reflect changes
        }
    };

    return (
        <div className="flex items-center space-x-2">
            <button
                onClick={() => handleStatusChange('pending')}
                disabled={isLoading || currentStatus === 'pending' || currentStatus === 'cancelled'}
                className={clsx(
                    'p-2 rounded-md transition-all duration-200',
                    'border',
                    {
                        'bg-yellow-100 border-yellow-500 text-yellow-700': currentStatus === 'pending',
                        'border-gray-300 text-gray-500 hover:bg-gray-100': currentStatus !== 'pending' 
                    }
                )}
                title="Pending"
            >
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
  <path d="M2.5 15a.5.5 0 1 1 0-1h1v-1a4.5 4.5 0 0 1 2.557-4.06c.29-.139.443-.377.443-.59v-.7c0-.213-.154-.451-.443-.59A4.5 4.5 0 0 1 3.5 3V2h-1a.5.5 0 0 1 0-1h11a.5.5 0 0 1 0 1h-1v1a4.5 4.5 0 0 1-2.557 4.06c-.29.139-.443.377-.443.59v.7c0 .213.154.451.443.59A4.5 4.5 0 0 1 12.5 13v1h1a.5.5 0 0 1 0 1zm2-13v1c0 .537.12 1.045.337 1.5h6.326c.216-.455.337-.963.337-1.5V2zm3 6.35c0 .701-.478 1.236-1.011 1.492A3.5 3.5 0 0 0 4.5 13s.866-1.299 3-1.48zm1 0v3.17c2.134.181 3 1.48 3 1.48a3.5 3.5 0 0 0-1.989-3.158C8.978 9.586 8.5 9.052 8.5 8.351z"/>
</svg>
            </button>

            <button
                onClick={() => handleStatusChange('served')}
                disabled={isLoading || !isSelectable('served')}
                className={clsx(
                    'p-2 rounded-md transition-all duration-200',
                    'border',
                    {
                        'bg-blue-100 border-blue-500 text-blue-700': currentStatus === 'served',
                        'border-gray-300 text-gray-500 hover:bg-gray-100': currentStatus !== 'served',
                    }
                )}
                title="Served"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
  <path d="M6.956 1.745C7.021.81 7.908.087 8.864.325l.261.066c.463.116.874.456 1.012.965.22.816.533 2.511.062 4.51a10 10 0 0 1 .443-.051c.713-.065 1.669-.072 2.516.21.518.173.994.681 1.2 1.273.184.532.16 1.162-.234 1.733q.086.18.138.363c.077.27.113.567.113.856s-.036.586-.113.856c-.039.135-.09.273-.16.404.169.387.107.819-.003 1.148a3.2 3.2 0 0 1-.488.901c.054.152.076.312.076.465 0 .305-.089.625-.253.912C13.1 15.522 12.437 16 11.5 16H8c-.605 0-1.07-.081-1.466-.218a4.8 4.8 0 0 1-.97-.484l-.048-.03c-.504-.307-.999-.609-2.068-.722C2.682 14.464 2 13.846 2 13V9c0-.85.685-1.432 1.357-1.615.849-.232 1.574-.787 2.132-1.41.56-.627.914-1.28 1.039-1.639.199-.575.356-1.539.428-2.59z"/>
</svg>
            </button>

            {/* Conditionally render the Paid button */}
            {showingPaidStatus && (
                <button
                    onClick={() => handleStatusChange('paid')}
                    disabled={isLoading || !isSelectable('paid')}
                    className={clsx(
                        'p-2 rounded-md transition-all duration-200',
                        'border',
                        {
                            'bg-green-100 border-green-500 text-green-700': currentStatus === 'paid',
                            'border-gray-300 text-gray-500 hover:bg-gray-100': currentStatus !== 'paid',
                        }
                    )}
                    title="Paid"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M4 10.781c.148 1.667 1.513 2.85 3.591 3.003V15h1.043v-1.216c2.27-.179 3.678-1.438 3.678-3.3 0-1.59-.947-2.51-2.956-3.028l-.722-.187V3.467c1.122.11 1.879.714 2.07 1.616h1.47c-.166-1.6-1.54-2.748-3.54-2.875V1H7.591v1.233c-1.939.23-3.27 1.472-3.27 3.156 0 1.454.966 2.483 2.661 2.917l.61.162v4.031c-1.149-.17-1.94-.8-2.131-1.718zm3.391-3.836c-1.043-.263-1.6-.825-1.6-1.616 0-.944.704-1.641 1.8-1.828v3.495l-.2-.05zm1.591 1.872c1.287.323 1.852.859 1.852 1.769 0 1.097-.826 1.828-2.2 1.939V8.73z"/>
                    </svg>
                </button>
            )}

            <button
                onClick={() => handleStatusChange('cancelled')}
                disabled={isLoading || !isSelectable('cancelled')}
                className={clsx(
                    'p-2 rounded-md transition-all duration-200',
                    'border',
                    {
                        'bg-red-100 border-red-500 text-red-700': currentStatus === 'cancelled',
                        'border-gray-300 text-gray-500 hover:bg-gray-100': currentStatus !== 'cancelled',
                    }
                )}
                title="Cancelled"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/>
                </svg>
            </button>

            {isLoading && <span className="text-sm text-blue-500">Updating...</span>}
            {error && <span className="text-sm text-red-500">{error}</span>}
        </div>
    );
};

export default OrderRowStatusSwitcher;