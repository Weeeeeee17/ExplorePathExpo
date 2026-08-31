import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { PetVisualId } from '../domain/types';
import { OwnedStage, seriesFor } from '../domain/petCatalog';

const art: Record<PetVisualId, Partial<Record<OwnedStage, number>>> = {
  pebble: { egg: require('../../assets/pets/pebble/egg.jpg'), juvenile: require('../../assets/pets/pebble/juvenile.jpg') },
  water: { egg: require('../../assets/pets/water/egg.jpg'), juvenile: require('../../assets/pets/water/juvenile.jpg') },
  porcelain: { egg: require('../../assets/pets/porcelain/egg.jpg'), juvenile: require('../../assets/pets/porcelain/juvenile.jpg') },
  marble: { egg: require('../../assets/pets/marble/egg.jpg'), juvenile: require('../../assets/pets/marble/juvenile.jpg') },
  cloud: { egg: require('../../assets/pets/cloud/egg.jpg') },
  thought: { egg: require('../../assets/pets/thought/egg.jpg'), juvenile: require('../../assets/pets/thought/juvenile.jpg') },
  voyager: { egg: require('../../assets/pets/voyager/egg.jpg') },
  brass: { egg: require('../../assets/pets/brass/egg.jpg'), juvenile: require('../../assets/pets/brass/juvenile.jpg') },
  frosted: { egg: require('../../assets/pets/frosted/egg.jpg'), juvenile: require('../../assets/pets/frosted/juvenile.jpg') },
  wood: { egg: require('../../assets/pets/wood/egg.jpg'), juvenile: require('../../assets/pets/wood/juvenile.jpg') },
  compass: { egg: require('../../assets/pets/compass/egg.jpg') },
  stargazer: { egg: require('../../assets/pets/stargazer/egg.jpg') },
};
/** Never substitutes another species or stage; original JPGs are contained, not cropped. */
export function PetImage({ seriesId, stage = 'egg', size = 200 }: { seriesId?: string; stage?: string; size?: number }) {
  const source = seriesId ? art[seriesId as PetVisualId]?.[stage as OwnedStage] : undefined;
  const [failedSource, setFailedSource] = useState<number | null>(null);
  return <View style={{ width: size, height: size, borderRadius: 18, backgroundColor: '#EFE5D5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    {source && source !== failedSource ? <Image source={source} resizeMode="contain" style={{ width: '100%', height: '100%' }} accessibilityLabel={`${seriesFor(seriesId)?.name ?? '夥伴'}・${stage}`} onError={() => setFailedSource(source)} />
      : <Text accessibilityLabel="探索者徽章或暫無可用外觀" style={{ color: '#365844', fontSize: size / 3 }}>⌁</Text>}
  </View>;
}
