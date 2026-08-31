import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { TeamRoom, teamLocationState } from '../domain/social';
import { colors } from '../theme';

export function TeamMap({ room, now }: { room: TeamRoom; now: number }) {
  const center = room.destination ?? room.members.find((member) => member.location)?.location;
  if (!center) return <View style={styles.empty}><Text>等待第一個有效位置；不顯示模擬定位。</Text></View>;
  return <View style={styles.wrap}><MapView style={StyleSheet.absoluteFill} initialRegion={{ ...center, latitudeDelta: 0.016, longitudeDelta: 0.016 }}>
    {room.destination && <><Marker coordinate={room.destination} title={room.destinationName} pinColor={colors.sunset} /><Circle center={room.destination} radius={60} fillColor="rgba(232,122,71,0.15)" strokeColor={colors.sunset} /></>}
    {room.members.filter((member) => member.location && teamLocationState(member.location.timestamp, now) !== 'offline').map((member) => {
      const location = member.location!;
      const state = teamLocationState(location.timestamp, now);
      return <Marker key={member.profile.id} coordinate={location} title={member.profile.nickname} description={state === 'fresh' ? '位置正常' : '這是舊位置，請留意更新時間'} pinColor={state === 'fresh' ? colors.forest : state === 'delayed' ? '#DCA732' : '#898C86'} />;
    })}
  </MapView></View>;
}
const styles = StyleSheet.create({ wrap: { height: 300, borderRadius: 24, overflow: 'hidden', marginVertical: 14 }, empty: { padding: 28, backgroundColor: colors.softMoss, borderRadius: 20 } });
