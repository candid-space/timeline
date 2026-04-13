import { PageShell } from '../components/pageShell';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from '../utils/appContext';
import DirTree from '../components/dirTree';
import MemoFeed from '../components/memoFeed';
import { IonIcon, useIonModal } from '@ionic/react';
import { terminalOutline, addCircleOutline } from 'ionicons/icons';
import WebsocketConsole from './console';
import Send from './send';
import { indexTransactionsToGraph } from '../utils/indexer';
import { Transaction } from '../utils/appTypes';

const toDisplayPath = (value: string) => {
  const trimmedValue = value.replace(/0+=+$/g, '');
  return trimmedValue || '/';
};

const buildPathSegments = (value: string) => {
  if (!value.startsWith('/')) {
    return [];
  }

  const normalized = toDisplayPath(value);
  if (normalized === '/') {
    return [];
  }

  const parts = normalized.split('/').filter(Boolean);
  let currentPath = '/';

  return parts.map((segment) => {
    currentPath = `${currentPath}${segment}/`;
    return {
      label: segment,
      value: currentPath,
    };
  });
};

const Explore = () => {
  const {
    graph,
    setGraph,
    tipHeader,
    navigatorPublicKey,
    setNavigatorPublicKey,
    transactionRange,
    requestPkTransactions,
  } =
    useContext(AppContext);

  const [mode, setMode] = useState<'feed' | 'tree'>('feed');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fetchStartHeight, setFetchStartHeight] = useState<number>(0);
  const [canLoadMore, setCanLoadMore] = useState<boolean>(true);
  const [focusTransactionId, setFocusTransactionId] = useState<string | null>(null);
  const [peekGraphKey, setPeekGraphKey] = useState<string>('/');
  const [breadcrumbPath, setBreadcrumbPath] = useState<string>('../');
  const [rangeEndHeight, setRangeEndHeight] = useState<number>(0);
  const whichKey = useMemo(() => toDisplayPath(peekGraphKey), [peekGraphKey]);
  const clickableSegments = useMemo(() => buildPathSegments(breadcrumbPath), [breadcrumbPath]);

  const [presentSendModal, dismissSend] = useIonModal(Send, {
    onDismiss: (data: string, role: string) => dismissSend(data, role),
    forKey: whichKey,
  });

  const [presentSocketConsole, dismissSocketConsole] = useIonModal(
    WebsocketConsole,
    {
      onDismiss: () => dismissSocketConsole(),
    },
  );

  const fetchTransactions = useCallback((
    startHeight: number,
    endHeight: number,
    replace: boolean,
  ) => {
    if (!navigatorPublicKey) {
      return;
    }

    requestPkTransactions(
      navigatorPublicKey,
      (nextTransactions) => {
        setTransactions((previous) =>
          replace ? nextTransactions : [...previous, ...nextTransactions],
        );
        const nextCursor = nextTransactions
          .map((tx) => tx.series)
          .filter((series): series is number => Number.isFinite(series))
          .reduce((minSeries, series) => Math.min(minSeries, series), Number.POSITIVE_INFINITY);
        const effectiveNextStart = Number.isFinite(nextCursor)
          ? nextCursor - 1
          : endHeight - 1;
        setFetchStartHeight(Math.max(rangeEndHeight, effectiveNextStart));
        setCanLoadMore(
          nextTransactions.length >= transactionRange.limit &&
          effectiveNextStart >= rangeEndHeight,
        );
      },
      {
        startHeight,
        endHeight,
        limit: transactionRange.limit,
      },
    );
  }, [navigatorPublicKey, rangeEndHeight, requestPkTransactions, transactionRange.limit]);

  useEffect(() => {
    let cleanup = () => {};
    const timeoutId = window.setTimeout(() => {
      if (!navigatorPublicKey) {
        setGraph(null);
        setTransactions([]);
        setBreadcrumbPath('../');
        setCanLoadMore(false);
        return;
      }

      const resolvedStartHeight = transactionRange.startHeight > 0
        ? transactionRange.startHeight
        : (tipHeader?.header.height ? tipHeader.header.height + 1 : 1);
      const resolvedEndHeight = Math.max(0, transactionRange.endHeight);
      setRangeEndHeight(resolvedEndHeight);
      setFetchStartHeight(resolvedStartHeight);
      fetchTransactions(resolvedStartHeight, resolvedEndHeight, true);
    }, 0);

    return () => {
      cleanup();
      window.clearTimeout(timeoutId);
    };
  }, [
    navigatorPublicKey,
    requestPkTransactions,
    setGraph,
    tipHeader?.header.height,
    transactionRange.startHeight,
    transactionRange.endHeight,
    fetchTransactions,
  ]);

  useEffect(() => {
    const resultHandler = (data: any) => {
      if (whichKey && data.detail) {
        if (!navigatorPublicKey) {
          return;
        }
        if (transactionRange.startHeight > 0) {
          return;
        }

        const liveStart = tipHeader?.header.height ? tipHeader.header.height + 1 : 1;
        fetchTransactions(liveStart, rangeEndHeight, true);
      }
    };

    document.addEventListener('inv_block', resultHandler);

    return () => {
      document.removeEventListener('inv_block', resultHandler);
    };
  }, [
    navigatorPublicKey,
    requestPkTransactions,
    tipHeader?.header.height,
    transactionRange.startHeight,
    transactionRange.endHeight,
    fetchTransactions,
    rangeEndHeight,
    whichKey,
  ]);

  useEffect(() => {
    if (!navigatorPublicKey) {
      setGraph(null);
      return;
    }

    setGraph(indexTransactionsToGraph(transactions, navigatorPublicKey));
  }, [navigatorPublicKey, setGraph, transactions]);

  const loadMore = useCallback(() => {
    if (!canLoadMore) {
      return;
    }

    const nextEndHeight = fetchStartHeight - 1;
    const nextStartHeight = Math.max(rangeEndHeight, nextEndHeight - transactionRange.limit + 1);
    fetchTransactions(nextStartHeight, nextEndHeight, false);
  }, [canLoadMore, fetchStartHeight, fetchTransactions, rangeEndHeight, transactionRange.limit]);

  return (
    <PageShell
      tools={[
        {
          label: 'Send',
          renderIcon: () => <IonIcon
            slot="icon-only"
            icon={addCircleOutline}
          />,
          action: () => presentSendModal(),
        },
        {
          label: 'WebSocket console',
          renderIcon: () => <IonIcon slot="icon-only" icon={terminalOutline} />,
          action: () => presentSocketConsole(),
        },
      ]}
      renderBody={() => (
        <>
          {!!whichKey && (
            <>
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 20,
                  background: 'var(--ion-background-color)',
                  borderBottom: '1px solid var(--ion-color-step-150)',
                  padding: '8px 0',
                  marginBottom: 8,
                }}
              >
                <div style={{ fontFamily: 'monospace, monospace', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => {
                    setPeekGraphKey('/');
                    setBreadcrumbPath('../');
                    if (mode === 'feed') {
                      setMode('tree');
                    }
                  }} style={{ border: 'none', background: 'transparent', color: 'var(--ion-color-primary)', textDecoration: 'underline' }}>
                    ..
                  </button>
                  {breadcrumbPath.startsWith('/') && <code>/</code>}
                  {!breadcrumbPath.startsWith('/') && <code>{breadcrumbPath}</code>}
                  {clickableSegments.map((segment, index) => (
                    <div key={segment.value} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button type="button" onClick={() => {
                        setPeekGraphKey(segment.value);
                        if (mode === 'feed') {
                          setMode('tree');
                        }
                      }} style={{ border: 'none', background: 'transparent', color: 'var(--ion-color-primary)', textDecoration: 'underline' }}>
                        {segment.label}
                      </button>
                      {index < clickableSegments.length - 1 && <code>/</code>}
                    </div>
                  ))}
                </div>
              </div>
              {!!graph && (
                <>
                  {mode === 'tree' && (
                    <DirTree
                      forKey={whichKey}
                      nodes={graph.nodes ?? []}
                      links={graph.links ?? []}
                      setForKey={setPeekGraphKey}
                      onLeafOpen={(txId) => {
                        setMode('feed');
                        setFocusTransactionId(txId);
                      }}
                    />
                  )}
                  {mode === 'feed' && (
                    <MemoFeed
                      transactions={transactions}
                      onLoadMore={loadMore}
                      canLoadMore={canLoadMore}
                      focusTransactionId={focusTransactionId}
                      onSwitchNavigator={(nextKey) => {
                        setNavigatorPublicKey(nextKey);
                        setPeekGraphKey('/');
                        setBreadcrumbPath('../');
                        setFocusTransactionId(null);
                        setMode('feed');
                      }}
                      onActivePathChange={(path) => {
                        setBreadcrumbPath(path);
                        if (mode === 'feed') {
                          setPeekGraphKey(path.startsWith('/') ? path : '/');
                        }
                      }}
                    />
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    />
  );
};

export default Explore;
