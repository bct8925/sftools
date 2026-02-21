interface CollapseChevronProps {
    isOpen: boolean;
}

export function CollapseChevron({ isOpen }: CollapseChevronProps) {
    return (
        <svg
            className={`card-collapse-chevron ${isOpen ? 'card-collapse-chevron-open' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <polyline points="9 6 15 12 9 18" />
        </svg>
    );
}
