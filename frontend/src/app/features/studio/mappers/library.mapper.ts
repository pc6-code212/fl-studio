import {
  LibraryNodeDto,
  LibraryResponseDto
} from '@core/services/library-api.service';
import { LibraryNode, LibraryResponse } from '../models/studio.model';

function mapNode(dto: LibraryNodeDto): LibraryNode {
  return {
    name: dto.name,
    path: dto.path,
    type: dto.type,
    size: dto.size,
    children: dto.children ? dto.children.map(mapNode) : undefined
  };
}

export function mapLibraryResponse(dto: LibraryResponseDto): LibraryResponse {
  return {
    root: dto.root,
    folders: {
      samples: dto.folders.samples.map(mapNode),
      effects: dto.folders.effects.map(mapNode),
      instruments: dto.folders.instruments.map(mapNode)
    }
  };
}
