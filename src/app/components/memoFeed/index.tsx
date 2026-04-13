import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonText,
} from '@ionic/react';
import { useMemo } from 'react';
import { Transaction } from '../../utils/appTypes';
import { getMemoContent } from '../../utils/memoContent';
import { transactionID } from '../../utils/compat';

type FeedItem = Transaction & {
  txId: string;
};

const normalizePath = (value?: string) => {
  if (!value?.startsWith('/')) {
    return null;
  }

  const compact = `${value.replace(/0+=+$/g, '').replace(/\/{2,}/g, '/')}`;
  if (compact === '/') {
    return '/';
  }

  return compact.endsWith('/') ? compact : `${compact}/`;
};

const isWithinPath = (path: string, targetPath: string) => {
  if (path === '/') {
    return true;
  }

  return targetPath.startsWith(path);
};

const byNewest = (a: FeedItem, b: FeedItem) => {
  const aSeries = a.series ?? 0;
  const bSeries = b.series ?? 0;

  if (aSeries !== bSeries) {
    return bSeries - aSeries;
  }

  if (a.time !== b.time) {
    return b.time - a.time;
  }

  return a.txId < b.txId ? 1 : -1;
};

export const normalizeFeedTransactions = (transactions: Transaction[]) => {
  const unique = new Map<string, FeedItem>();

  transactions.forEach((transaction) => {
    const txId = transactionID(transaction);
    const candidate: FeedItem = {
      ...transaction,
      txId,
    };

    const previous = unique.get(txId);
    if (!previous || byNewest(candidate, previous) < 0) {
      unique.set(txId, candidate);
    }
  });

  return Array.from(unique.values()).sort(byNewest).slice(0, 500);
};

const MemoFeed = ({
  transactions,
  currentPath,
  onDrill,
  onLoadMore,
  canLoadMore,
}: {
  transactions: Transaction[];
  currentPath: string;
  onDrill: (path: string) => void;
  onLoadMore: () => void;
  canLoadMore: boolean;
}) => {
  const normalizedPath = normalizePath(currentPath) ?? '/';

  const feedItems = useMemo(() => {
    return normalizeFeedTransactions(transactions).filter((item) => {
      const toPath = normalizePath(item.to);
      if (!toPath) {
        return normalizedPath === '/';
      }

      return isWithinPath(normalizedPath, toPath);
    });
  }, [transactions, normalizedPath]);

  return (
    <div>
      {feedItems.map((item) => {
        const content = getMemoContent(item.memo);
        const toPath = normalizePath(item.to);
        const fromPath = normalizePath(item.from);

        return (
          <IonCard id={`feed-item-${item.txId}`} key={item.txId}>
            <IonCardHeader>
              <IonCardSubtitle>{item.txId.slice(0, 14)}…</IonCardSubtitle>
              <IonCardTitle style={{ fontSize: 14 }}>
                series: {item.series ?? 'n/a'} · time: {item.time}
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                {toPath && toPath !== normalizedPath && (
                  <IonButton size="small" fill="outline" onClick={() => onDrill(toPath)}>
                    Drill in
                  </IonButton>
                )}
                {fromPath && fromPath !== normalizedPath && (
                  <IonButton size="small" fill="outline" onClick={() => onDrill(fromPath)}>
                    Drill out
                  </IonButton>
                )}
              </div>

              {content.type === 'empty' && (
                <IonText color="medium">
                  <p style={{ margin: 0, fontSize: 12 }}>{content.text}</p>
                </IonText>
              )}

              {content.type === 'text' && (
                <IonText>
                  <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{content.text}</p>
                </IonText>
              )}

              {content.type === 'url' && (
                <iframe
                  title="Memo web content"
                  src={content.url}
                  style={{ width: '100%', height: '65vh', border: 'none', borderRadius: 8 }}
                  referrerPolicy="strict-origin-when-cross-origin"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
              )}

              {content.type === 'youtube' && (
                <div style={{ position: 'relative', width: '100%', paddingBottom: '177.78%' }}>
                  <iframe
                    title="Memo YouTube short"
                    src={`https://www.youtube.com/embed/${content.videoId}?autoplay=1&mute=1&playsinline=1`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      border: 'none',
                    }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              )}
            </IonCardContent>
          </IonCard>
        );
      })}

      <IonInfiniteScroll
        onIonInfinite={(event) => {
          onLoadMore();
          event.target.complete();
        }}
        threshold="100px"
        disabled={!canLoadMore}
      >
        <IonInfiniteScrollContent loadingText="Loading older memos..." />
      </IonInfiniteScroll>
    </div>
  );
};

export default MemoFeed;
