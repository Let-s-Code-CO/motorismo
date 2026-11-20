import PageSkeleton from '@web/modules/core/components/page-skeleton.component';

/** An order while its data arrive (spec 011, CA-01): the shape of the screen, not a frozen one. */
const Loading = () => <PageSkeleton variant="detail" />;

export default Loading;
