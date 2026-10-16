import com.google.gson.*;
import com.mojang.serialization.JsonOps;
import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.resources.Identifier;
import net.minecraft.client.resources.model.*;
import net.minecraft.client.resources.model.cuboid.*;
import net.minecraft.client.resources.model.sprite.*;
import net.minecraft.client.renderer.texture.*;
import net.minecraft.client.renderer.item.*;
import net.minecraft.client.model.geom.EntityModelSet;
import java.util.*;
import java.util.zip.*;
import java.io.*;

/** The game's CPU model bakery, with one UV-normalized sprite per PNG instead of a GPU atlas. */
class VanillaAssets implements SpriteGetter,MaterialBaker {
 final ZipFile jar;
 final Map<String,TextureAtlasSprite> sprites=new HashMap<>();
 final Map<String,String[]> palettes=new HashMap<>();
 net.minecraft.client.renderer.block.BlockModelResolver blocks;
 final EntityModelSet models=EntityModelSet.vanilla();
 ItemModelResolver resolver;
 ModelBakery.BakingResult baked;
 VanillaAssets(String path,JsonObject catalog)throws Exception {
  jar=new ZipFile(path);
  net.minecraft.client.ClientBootstrap.bootstrap();
  for(var entry:Collections.list(jar.entries()))if(entry.getName().startsWith("assets/minecraft/atlases/")&&entry.getName().endsWith(".json")) {
   var atlas=read(entry.getName().substring("assets/minecraft/".length()));
   for(var element:atlas.getAsJsonObject().getAsJsonArray("sources")) {var source=element.getAsJsonObject();if(!source.get("type").getAsString().endsWith("paletted_permutations"))continue;
    for(var texture:source.getAsJsonArray("textures"))for(var permutation:source.getAsJsonObject("permutations").entrySet()) {
     String base=texture.getAsString().replace("minecraft:","");palettes.put(base+"_"+permutation.getKey(),new String[]{base,source.get("palette_key").getAsString().replace("minecraft:",""),permutation.getValue().getAsString().replace("minecraft:","")});
    }
   }
  }
  Map<Identifier,UnbakedModel> cuboids=new HashMap<>();
  for(var entry:Collections.list(jar.entries())) {
   String name=entry.getName();if(!name.startsWith("assets/minecraft/models/")||!name.endsWith(".json"))continue;
   String id=name.substring("assets/minecraft/models/".length(),name.length()-5);
   try(var reader=new InputStreamReader(jar.getInputStream(entry),java.nio.charset.StandardCharsets.UTF_8)){cuboids.put(Identifier.withDefaultNamespace(id),CuboidModel.fromStream(reader));}
  }
  var discovery=new ModelDiscovery(cuboids,MissingCuboidModel.missingModel());
  discovery.addSpecialModel(ItemModelGenerator.GENERATED_ITEM_MODEL_ID,new ItemModelGenerator());
  Set<String> ids=new TreeSet<>(List.of("tnt","item_frame","glow_item_frame","fire_charge","firework_rocket"));
  for(var slot:catalog.getAsJsonArray("slots"))for(var item:slot.getAsJsonObject().getAsJsonArray("items"))ids.add(item.getAsString());
  Map<Identifier,ClientItem> items=new HashMap<>();
  for(String id:ids){var definition=ClientItem.CODEC.parse(JsonOps.INSTANCE,read("items/"+id+".json")).getOrThrow();items.put(Identifier.withDefaultNamespace(id),definition);discovery.addRoot(definition.model());}
  Map<net.minecraft.world.level.block.state.BlockState,net.minecraft.client.renderer.block.dispatch.BlockStateModel.UnbakedRoot> roots=new HashMap<>();
  for(String id:List.of("tnt","carved_pumpkin","red_mushroom","brown_mushroom")) {
   var state=net.minecraft.core.registries.BuiltInRegistries.BLOCK.getValue(Identifier.withDefaultNamespace(id)).defaultBlockState();
   var root=new net.minecraft.client.renderer.block.dispatch.SingleVariant.Unbaked(new net.minecraft.client.renderer.block.dispatch.Variant(Identifier.withDefaultNamespace("block/"+id))).asRoot();roots.put(state,root);discovery.addRoot(root);
  }
  for(boolean glow:new boolean[]{false,true})for(boolean map:new boolean[]{false,true}) {
   var root=new net.minecraft.client.renderer.block.dispatch.SingleVariant.Unbaked(new net.minecraft.client.renderer.block.dispatch.Variant(Identifier.withDefaultNamespace("block/"+(glow?"glow_":"")+"item_frame"+(map?"_map":"")))).asRoot();
   roots.put(net.minecraft.client.resources.model.BlockStateDefinitions.getItemFrameFakeState(glow,map),root);discovery.addRoot(root);
  }
  var bakery=new ModelBakery(models,this,null,roots,items,discovery.resolve(),discovery.missingModel());
  baked=bakery.bakeModels(this,Runnable::run).get();
  var manager=new ModelManager(null,null,null);
  CaptureScenes.set(manager,"bakedItemStackModels",baked.itemStackModels());CaptureScenes.set(manager,"itemProperties",baked.itemProperties());CaptureScenes.set(manager,"missingModels",baked.missingModels());CaptureScenes.set(manager,"entityModelSet",models);
  var stateModels=new net.minecraft.client.renderer.block.BlockStateModelSet(baked.blockStateModels(),baked.missingModels().block());
  CaptureScenes.set(manager,"blockStateModelSet",stateModels);
  CaptureScenes.set(manager,"blockModelSet",new net.minecraft.client.renderer.block.BlockModelSet(stateModels,Map.of(),net.minecraft.client.color.block.BlockColors.createDefault()));
  blocks=new net.minecraft.client.renderer.block.BlockModelResolver(manager);
  resolver=new ItemModelResolver(manager);
 }
 JsonElement read(String path)throws IOException {var entry=jar.getEntry("assets/minecraft/"+path);if(entry==null)throw new FileNotFoundException(path);try(var reader=new InputStreamReader(jar.getInputStream(entry),java.nio.charset.StandardCharsets.UTF_8)){return JsonParser.parseReader(reader);}}
 static class Sprite extends TextureAtlasSprite {
  Sprite(Identifier texture,SpriteContents contents){super(contents.name().getPath().startsWith("item/")||contents.name().getPath().startsWith("trims/items/")?TextureAtlas.LOCATION_ITEMS:TextureAtlas.LOCATION_BLOCKS,contents,contents.width(),contents.height(),0,0,0);}
 }
 public TextureAtlasSprite get(SpriteId id) {
  String name=id.texture().toString();return sprites.computeIfAbsent(name,key->{try{
   Identifier texture=id.texture();String path="textures/"+texture.getPath()+".png";NativeImage image;
   image=image(texture.getPath());
   var contents=new SpriteContents(texture,new net.minecraft.client.resources.metadata.animation.FrameSize(image.getWidth(),image.getHeight()),image);
   return new Sprite(Identifier.fromNamespaceAndPath(texture.getNamespace(),path),contents);
  }catch(Exception ex){throw new RuntimeException("Sprite "+name,ex);}});
 }
 NativeImage image(String path)throws Exception {
  var entry=jar.getEntry("assets/minecraft/textures/"+path+".png");
  if(entry!=null)try(var stream=jar.getInputStream(entry)){return NativeImage.read(stream);}
  if(path.equals("missingno"))return MissingTextureAtlasSprite.generateMissingImage();
  var recipe=palettes.get(path);if(recipe==null)throw new FileNotFoundException(path);
  try(var base=image(recipe[0]);var key=image(recipe[1]);var value=image(recipe[2])) {
   Map<Integer,Integer> palette=new HashMap<>();int[] keys=key.getPixels(),values=value.getPixels();for(int i=0;i<keys.length;i++)palette.put(keys[i]&0xffffff,values[i]);
   return base.mappedCopy(color->{int mapped=palette.getOrDefault(color&0xffffff,color);int alpha=(color>>>24)*(mapped>>>24)/255;return alpha<<24|mapped&0xffffff;});
  }
 }
 public Material.Baked get(Material mat,ModelDebugName debug){return new Material.Baked(get(new SpriteId(net.minecraft.data.AtlasIds.BLOCKS,mat.sprite())),mat.forceTranslucent());}
 public Material.Baked reportMissingReference(String ref,ModelDebugName debug){throw new IllegalStateException("Unresolved texture "+ref+" in "+debug);}
 net.minecraft.client.resources.model.EquipmentAssetManager equipment()throws Exception {
  var manager=new EquipmentAssetManager();Map<net.minecraft.resources.ResourceKey<net.minecraft.world.item.equipment.EquipmentAsset>,EquipmentClientInfo> map=new HashMap<>();
  for(var entry:Collections.list(jar.entries()))if(entry.getName().startsWith("assets/minecraft/equipment/")&&entry.getName().endsWith(".json")) {
   String path=entry.getName().substring("assets/minecraft/".length());String id=path.substring("equipment/".length(),path.length()-5);
   map.put(net.minecraft.resources.ResourceKey.create(net.minecraft.world.item.equipment.EquipmentAssets.ROOT_ID,Identifier.withDefaultNamespace(id)),EquipmentClientInfo.CODEC.parse(JsonOps.INSTANCE,read(path)).getOrThrow());
  }
  CaptureScenes.set(manager,"equipmentAssets",map);return manager;
 }
 void update(ItemStackRenderState state,String item,net.minecraft.world.item.ItemDisplayContext context) {
  var stack=new net.minecraft.world.item.ItemStack(net.minecraft.core.registries.BuiltInRegistries.ITEM.getValue(Identifier.withDefaultNamespace(item)));
  resolver.updateForTopItem(state,stack,context,null,null,0);
 }
}
