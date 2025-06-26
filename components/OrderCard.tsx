import Link from 'next/link';
import { Order, FoodData } from '@/types';


interface OrderCardProps {
    order: Order;
    foodData?: FoodData;
}

const formatMinutes = (minutes: number): string => {
    return minutes < 10 ? `0${minutes}` : `${minutes}`;
};

const OrderCard = ({ order, foodData }: OrderCardProps) => {
  const hasFoodToCook = foodData?.hasFoodToCook;
  const allFoodIsCooked = foodData?.allFoodIsCooked;
  const isPaid = order.orderStatus === 'paid'; // This is already correctly defined

  // Determine CSS classes based on order status
  // We'll build the base classes and then conditionally add 'animate-vibrate'
  let cardBaseClasses = `block p-4 border-2 rounded-lg shadow-sm hover:shadow-lg transition-shadow cursor-pointer flex flex-col justify-end`;
  let conditionalClasses = '';

  if (hasFoodToCook) {
    conditionalClasses = 'border-yellow-400 bg-yellow-100';
  } else if (allFoodIsCooked) {
    conditionalClasses = 'border-yellow-400 bg-green-100'; // Note: The previous logic had a typo here, it was `isPaid`
  } else if (isPaid) { // Explicitly check for paid to ensure different styling
    conditionalClasses = 'border-gray-300 bg-white'; // No vibration for paid orders
  } else {
    // Default if none of the above conditions are met (e.g., pending, but not food-related)
    conditionalClasses = 'border-gray-300 bg-white';
  }

  // Conditionally add animate-vibrate if not paid
  const vibrateClass = isPaid ? '' : 'animate-vibrate';

  const cardClasses = `${cardBaseClasses} ${conditionalClasses} ${vibrateClass}`;


  const customerNameClasses = `font-bold text-lg mb-4 ${
    hasFoodToCook ? 'text-orange-400' : 'text-green-500'
  }`;

  const createdAtClasses = `font-semibold ${
    hasFoodToCook ? 'text-orange-600' : 'text-green-600'
  }`;

  return (
    <Link key={order.documentId} href={`/order/${order.documentId}`} passHref legacyBehavior>
      <a className={cardClasses}>
        {hasFoodToCook && (
          <div className="flex justify-end">
            <audio src="/notification.mp3" autoPlay />
            {/* SVG for 'hasFoodToCook' */}
            <svg fill="#000000" height="40" width="40" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 513.164 513.164" xmlSpace="preserve">
              <g><g><circle cx="221.673" cy="175.709" r="11.636" /></g></g>
              <g><g><circle cx="291.491" cy="175.709" r="11.636" /></g></g>
              <g><g><circle cx="210.036" cy="396.8" r="11.636" /></g></g>
              <g><g><circle cx="303.127" cy="396.8" r="11.636" /></g></g>
              <g><g><circle cx="210.036" cy="443.345" r="11.636" /></g></g>
              <g><g><circle cx="303.127" cy="443.345" r="11.636" /></g></g>
              <g><g><path d="M268.218,222.255h-23.273c-6.982,0-11.636,4.655-11.636,11.636s4.655,11.636,11.636,11.636h23.273
                c6.982,0,11.636-4.655,11.636-11.636S275.2,222.255,268.218,222.255z"/></g></g>
              <g><g><path d="M407.855,343.273l-79.127-16.291c-5.818-1.164-12.8,2.327-13.964,9.309c-1.164,5.818,2.327,12.8,9.309,13.964
                l79.127,16.291c16.291,3.491,27.927,17.455,27.927,33.745v77.964c0,6.982-4.655,11.636-11.636,11.636H93.673
                c-6.982,0-11.636-4.655-11.636-11.636v-77.964c0-16.291,11.636-31.418,27.927-33.745l77.964-15.127h91.927
                c6.982,0,11.636-4.655,11.636-11.636c0-6.982-4.655-11.636-11.636-11.636h-93.091c-1.164,0-1.164,0-2.327,0l-79.127,15.127
                c-26.764,5.818-46.545,29.091-46.545,57.018v77.964c0,19.782,15.127,34.909,34.909,34.909h325.818
                c19.782,0,34.909-15.127,34.909-34.909v-77.964C454.4,372.364,434.618,347.927,407.855,343.273z"/></g></g>
              <g><g><path d="M358.982,152.436c-6.982-1.164-11.636,3.491-12.8,10.473c-2.327,20.945-5.818,43.055-5.818,43.055
                c-1.164,15.127-8.146,29.091-17.455,40.727l-2.327,3.491c-15.127,19.782-38.4,30.255-64,30.255c-25.6,0-48.873-10.473-64-30.255
                l-2.327-3.491c-9.309-11.636-16.291-25.6-17.455-41.891c0,0-9.309-54.691-9.309-76.8V98.909c0-4.655-2.327-8.146-5.818-10.473
                c-10.473-4.655-17.455-16.291-17.455-29.091c0-19.782,15.127-34.909,34.909-34.909c6.982,0,11.636-4.655,11.636-11.636
                s-4.655-11.636-11.636-11.636c-32.582,0-58.182,25.6-58.182,58.182c0,18.618,9.309,36.073,23.273,46.545v23.273
                c0,23.273,8.145,77.964,9.309,79.127c2.327,19.782,10.473,38.4,22.109,53.527l2.327,3.491c19.782,24.436,50.036,38.4,82.618,38.4
                c32.582,0,61.673-13.964,82.618-38.4l2.327-3.491c12.8-15.127,19.782-33.745,22.109-52.364c0,0,3.491-22.109,5.818-44.218
                C370.618,159.418,365.964,153.6,358.982,152.436z"/></g></g>
              <g><g><path d="M256.582,1.164c-32.582,0-58.182,25.6-58.182,58.182c0,6.982,4.655,11.636,11.636,11.636
                c6.982,0,11.636-4.655,11.636-11.636c0-19.782,15.127-34.909,34.909-34.909c6.982,0,11.636-4.655,11.636-11.636
                S263.564,1.164,256.582,1.164z"/></g></g>
              <g><g><path d="M338.036,0c-20.945,0-40.727,11.636-51.2,30.255c-4.655,10.473-6.982,19.782-6.982,29.091
                c0,6.982,4.655,11.636,11.636,11.636s11.636-4.655,11.636-11.636c0-5.818,1.164-11.636,4.655-16.291
                c5.818-11.636,17.455-18.618,30.255-18.618c19.782,0,34.909,15.127,34.909,34.909c0,12.8-6.982,24.436-17.455,30.255
                c-3.491,2.327-5.818,5.818-5.818,10.473v19.782c-48.873,10.473-108.218,11.636-161.745,4.655
                c-5.818-1.164-11.636,3.491-12.8,9.309s3.491,12.8,9.309,12.8c23.273,3.491,46.545,4.655,70.982,4.655
                c37.236,0,75.636-3.491,108.218-11.636c4.655-1.164,9.309-5.818,9.309-11.636v-23.273c13.964-10.473,23.273-27.927,23.273-46.545
                C396.218,25.6,370.618,0,338.036,0z"/></g></g>
            </svg>
          </div>
        )}

        {allFoodIsCooked && (
          <div className="flex justify-end">
            <audio src="/ready.mp3" autoPlay />
            {/* SVG for 'allFoodIsCoocked' */}
            <svg fill="#000000" height="40" width="40" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512" xmlSpace="preserve">
              <g><g><path d="M503.83,388.085H8.17c-4.513,0-8.17,3.657-8.17,8.17s3.657,8.17,8.17,8.17h25.333c3.795,18.624,20.3,32.681,40.029,32.681
                h364.936c19.728,0,36.233-14.057,40.029-32.681h25.333c4.513,0,8.17-3.657,8.17-8.17S508.343,388.085,503.83,388.085z
                M438.468,420.766H73.532c-10.651,0-19.733-6.831-23.105-16.34h411.147C458.201,413.935,449.119,420.766,438.468,420.766z"/></g></g>
              <g><g><circle cx="156.868" cy="232.851" r="8.17" /></g></g>
              <g><g><circle cx="124.187" cy="265.532" r="8.17" /></g></g>
              <g><g><path d="M264.17,140.421v-16.506h24.511c4.513,0,8.17-3.657,8.17-8.17c0-22.526-18.325-40.851-40.851-40.851
                s-40.851,18.325-40.851,40.851c0,4.513,3.657,8.17,8.17,8.17s8.17-3.657,8.17-8.17c0-13.515,10.996-24.511,24.511-24.511
                c10.652,0,19.738,6.83,23.111,16.34H256c-4.513,0-8.17,3.657-8.17,8.17v24.676C128.463,144.737,32.681,243.173,32.681,363.574
                c0,4.513,3.657,8.17,8.17,8.17s8.17-3.657,8.17-8.17c0-114.129,92.85-206.979,206.979-206.979s206.979,92.85,206.979,206.979
                c0,4.513,3.657,8.17,8.17,8.17s8.17-3.657,8.17-8.17C479.319,243.173,383.537,144.737,264.17,140.421z"/></g></g>
            </svg>
          </div>
        )}
        <p className="font-bold text-lg text-gray-900">Table: {order.tableName || 'N/A'}</p>
        <p className={customerNameClasses}>{order.customerName}</p>
        <p className="text-sm text-gray-600">Created: <span className={createdAtClasses}>{`${new Date(order.createdAt).getHours()}:${formatMinutes(new Date(order.createdAt).getMinutes())}`}</span></p>
      </a>
    </Link>
  );
};

export default OrderCard;