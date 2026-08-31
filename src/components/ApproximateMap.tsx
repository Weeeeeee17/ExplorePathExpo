import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { destinationTarget } from '../domain/geo';
import { Destination, GeoPoint } from '../domain/types';
import { colors, radius } from '../theme';

export function ApproximateMap({
  destination,
  currentLocation,
  hintUnlocked,
  revealed,
}: {
  destination: Destination;
  currentLocation: GeoPoint | null;
  hintUnlocked: boolean;
  revealed: boolean;
}) {
  const target = destinationTarget(destination);
  const radiusMeters = hintUnlocked ? 100 : 175;
  return (
    <View style={styles.wrap}>
      <MapView
        initialRegion={{
          latitude: target.latitude,
          longitude: target.longitude,
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        }}
        mapType="mutedStandard"
        pitchEnabled={false}
        rotateEnabled={false}
        showsCompass={false}
        style={styles.map}
      >
        <Circle
          center={target}
          fillColor="rgba(41,87,64,0.16)"
          radius={radiusMeters}
          strokeColor="rgba(41,87,64,0.72)"
          strokeWidth={2}
        />
        {currentLocation ? <Marker coordinate={currentLocation} pinColor="#E48C68" title="你的位置" /> : null}
        {revealed ? <Marker coordinate={{ latitude: destination.latitude, longitude: destination.longitude }} title={destination.internalName} /> : null}
      </MapView>
      <View style={styles.caption}>
        <Text style={styles.captionText}>
          {revealed ? '目的地已揭曉' : `目的地約在圈內 · 範圍約 ${radiusMeters} 公尺`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.card, height: 270, marginBottom: 16, overflow: 'hidden' },
  map: { flex: 1 },
  caption: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radius.pill,
    bottom: 12,
    paddingHorizontal: 13,
    paddingVertical: 8,
    position: 'absolute',
  },
  captionText: { color: colors.forest, fontSize: 12, fontWeight: '800' },
});
